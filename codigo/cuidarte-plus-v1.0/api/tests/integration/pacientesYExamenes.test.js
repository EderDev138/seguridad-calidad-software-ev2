import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { crearEntorno, sembrarEscenarioClinico, iniciarSesion } from '../soporte/entorno.js';
import { ACCIONES_AUDITABLES } from '../../src/domain/model/roles.js';

/**
 * Casos CP-FUN-06, CP-FUN-07, CP-FUN-08 y CP-INT-03 · ciclo de vida completo
 * de pacientes y examenes (RF-2.2, RF-2.3, RF-2.4, RF-3.1, RF-3.2, RF-4.1).
 *
 * Complementa `accesoYRoles.test.js`: alli se verifica que las operaciones NO
 * autorizadas se rechazan; aqui se verifica que las SI autorizadas funcionan y
 * quedan auditadas. Sin este archivo, la matriz de trazabilidad declararia
 * cobertura de RF-2.3 sin haber ejecutado nunca una actualizacion exitosa.
 */

let entorno;
let escenario;
let sesiones;

beforeEach(async () => {
  entorno = await crearEntorno();
  escenario = await sembrarEscenarioClinico(entorno.gateways);
  sesiones = {
    medico: await iniciarSesion(entorno.app, request, 'medico1'),
    admin: await iniciarSesion(entorno.app, request, 'admin1'),
    paciente: await iniciarSesion(entorno.app, request, 'paciente1'),
  };
}, 60_000);

const comoAutorizado = (peticion, sesion) =>
  peticion.set('Authorization', `Bearer ${sesion.token}`);

describe('CP-FUN-06 · Registro de paciente por el medico (RF-2.2)', () => {
  test('crea el paciente con 201 y normaliza el RUT', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).post('/api/v1/pacientes').send({
        rut: '20.347.024-K',
        nombres: 'Carla',
        apellidos: 'Rojas',
        fechaNacimiento: '1958-03-14',
        telefono: '+56912345678',
        email: 'carla.rojas@cuidarte.test',
      }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.rut).toBe('20347024-K');
    expect(respuesta.body.id).toBeDefined();
  });

  test('la creacion queda registrada en auditoria con el medico responsable', async () => {
    const creado = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '20347024-K', nombres: 'Carla', apellidos: 'Rojas' }),
      sesiones.medico,
    );

    const [registro] = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.CREAR_PACIENTE,
    });
    expect(registro.usuarioId).toBe(escenario.medico.id);
    expect(registro.entidadId).toBe(creado.body.id);
  });

  test('rechaza un RUT con digito verificador invalido (400)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '12345678-9', nombres: 'Carla', apellidos: 'Rojas' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('rechaza la creacion sin nombres o sin apellidos (400)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).post('/api/v1/pacientes').send({ rut: '20347024-K', nombres: 'Carla' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('el administrador tambien puede registrar pacientes (RB-2)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '20347024-K', nombres: 'Carla', apellidos: 'Rojas' }),
      sesiones.admin,
    );

    expect(respuesta.status).toBe(201);
  });
});

describe('CP-FUN-06 · Edicion y baja de paciente (RF-2.3)', () => {
  test('actualiza los datos de contacto y responde 200', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/pacientes/${escenario.paciente.id}`)
        .send({ telefono: '+56987654321', email: 'ana.perez@cuidarte.test' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.telefono).toBe('+56987654321');
    expect(respuesta.body.email).toBe('ana.perez@cuidarte.test');
  });

  test('permite cambiar el RUT a uno valido y no utilizado', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/pacientes/${escenario.paciente.id}`)
        .send({ rut: '20.347.024-K' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.rut).toBe('20347024-K');
  });

  test('rechaza con 409 el cambio a un RUT que ya pertenece a otro paciente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/pacientes/${escenario.paciente.id}`)
        .send({ rut: escenario.otroPaciente.rut }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(409);
  });

  test('reasignar el MISMO RUT al mismo paciente no se considera duplicado', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/pacientes/${escenario.paciente.id}`)
        .send({ rut: escenario.paciente.rut }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
  });

  test('exige al menos un campo a modificar (400)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).put(`/api/v1/pacientes/${escenario.paciente.id}`).send({}),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('responde 404 al editar un paciente inexistente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).put('/api/v1/pacientes/99999').send({ telefono: '+56900000000' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(404);
  });

  test('la baja del paciente es logica y queda auditada', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).delete(`/api/v1/pacientes/${escenario.paciente.id}`),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(await entorno.gateways.pacienteGateway.obtenerPorId(escenario.paciente.id)).toBeNull();

    const registros = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.ELIMINAR_PACIENTE,
    });
    expect(registros).toHaveLength(1);
  });

  test('responde 404 al eliminar un paciente inexistente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).delete('/api/v1/pacientes/99999'),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(404);
  });
});

describe('CP-FUN-07 · Registro y edicion de examenes (RF-3.1, RF-3.2)', () => {
  test('crea un examen con 201 y lo asocia al medico que lo registra', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).post('/api/v1/examenes').send({
        pacienteId: escenario.paciente.id,
        tipo: 'Perfil lipidico',
        descripcion: 'Control de colesterol',
        fechaExamen: '2026-10-12',
      }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.medicoId).toBe(escenario.medico.id);
    expect(respuesta.body.estado).toBe('PENDIENTE');
  });

  test('rechaza crear un examen para un paciente inexistente (404)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).post('/api/v1/examenes').send({ pacienteId: 99999, tipo: 'Rx' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(404);
  });

  test('actualiza el tipo, la descripcion y el estado del examen', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).put(`/api/v1/examenes/${escenario.examen.id}`).send({
        tipo: 'Hemograma completo',
        descripcion: 'Resultado dentro de rango',
        estado: 'COMPLETADO',
      }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tipo).toBe('Hemograma completo');
    expect(respuesta.body.estado).toBe('COMPLETADO');
  });

  test('rechaza un estado fuera del conjunto permitido (400)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/examenes/${escenario.examen.id}`)
        .send({ estado: 'ANULADO' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('responde 404 al editar o eliminar un examen inexistente', async () => {
    const edicion = await comoAutorizado(
      request(entorno.app).put('/api/v1/examenes/99999').send({ tipo: 'Rx' }),
      sesiones.medico,
    );
    expect(edicion.status).toBe(404);

    const baja = await comoAutorizado(
      request(entorno.app).delete('/api/v1/examenes/99999'),
      sesiones.medico,
    );
    expect(baja.status).toBe(404);
  });

  test('la edicion queda auditada indicando los campos modificados', async () => {
    await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/examenes/${escenario.examen.id}`)
        .send({ estado: 'COMPLETADO' }),
      sesiones.medico,
    );

    const [registro] = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.EDITAR_EXAMEN,
    });
    expect(registro.detalle).toContain('estado');
  });
});

describe('CP-FUN-08 / CP-INT-03 · Flujo escalonado paciente -> examenes (NFR-USAB-4, RF-4.1)', () => {
  test('el listado anidado devuelve los examenes del paciente indicado', async () => {
    await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Ecografia abdominal' }),
      sesiones.medico,
    );

    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.paciente.id}/examenes`),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(2);
    expect(respuesta.body.map((examen) => examen.pacienteId)).toEqual([
      escenario.paciente.id,
      escenario.paciente.id,
    ]);
  });

  test('un paciente inexistente en la ruta anidada responde 404', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/pacientes/99999/examenes'),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(404);
  });

  test('un id de ruta no numerico se rechaza con 400 antes de llegar al dominio', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/pacientes/abc/examenes'),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('el examen eliminado deja de aparecer en el listado del paciente', async () => {
    await comoAutorizado(
      request(entorno.app).delete(`/api/v1/examenes/${escenario.examen.id}`),
      sesiones.medico,
    );

    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.paciente.id}/examenes`),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(0);
  });

  test('el paciente ve el detalle de su examen y la lista de sus documentos', async () => {
    const detalle = await comoAutorizado(
      request(entorno.app).get(`/api/v1/examenes/${escenario.examen.id}`),
      sesiones.paciente,
    );
    expect(detalle.status).toBe(200);

    const documentos = await comoAutorizado(
      request(entorno.app).get(`/api/v1/examenes/${escenario.examen.id}/documentos`),
      sesiones.paciente,
    );
    expect(documentos.status).toBe(200);
    expect(documentos.body).toEqual([]);
  });
});

describe('Healthcheck del servicio (NFR-DIS-1, NFR-DIS-3)', () => {
  test('responde el estado, la version y el instante, sin requerir sesion', async () => {
    const respuesta = await request(entorno.app).get('/api/v1/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('operativo');
    expect(respuesta.body.version).toBeDefined();
    expect(respuesta.body.instante).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
