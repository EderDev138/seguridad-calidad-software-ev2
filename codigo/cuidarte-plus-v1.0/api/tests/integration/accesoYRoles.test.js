import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import {
  crearEntorno,
  sembrarEscenarioClinico,
  iniciarSesion,
  pdfDePrueba,
  ejecutableDisfrazado,
} from '../soporte/entorno.js';
import { ACCIONES_AUDITABLES } from '../../src/domain/model/roles.js';

/**
 * Casos CP-SEG-01, CP-SEG-02, CP-SEG-03, CP-SEG-07, CP-INT-01 a CP-INT-05.
 *
 * Es el bloque de pruebas mas importante del informe: verifica que el control
 * de acceso se aplica EN EL BACKEND (NFR-SEG-4) y que las reglas de negocio
 * RB-1, RB-2 y RB-3 se cumplen incluso cuando la peticion no viene de la
 * interfaz oficial.
 */

let entorno;
let escenario;
let sesiones;

beforeEach(async () => {
  entorno = await crearEntorno();
  escenario = await sembrarEscenarioClinico(entorno.gateways);
  sesiones = {
    admin: await iniciarSesion(entorno.app, request, 'admin1'),
    medico: await iniciarSesion(entorno.app, request, 'medico1'),
    paciente: await iniciarSesion(entorno.app, request, 'paciente1'),
    otroPaciente: await iniciarSesion(entorno.app, request, 'paciente2'),
  };
}, 60_000);

const comoAutorizado = (peticion, sesion) =>
  peticion.set('Authorization', `Bearer ${sesion.token}`);

describe('CP-SEG-01 · RBAC en backend: el paciente solo lee (NFR-SEG-4, RB-1)', () => {
  test('un paciente NO puede crear un examen (403)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Examen falso' }),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe('NO_AUTORIZADO');
  });

  test('un paciente NO puede modificar su propio examen (403)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/examenes/${escenario.examen.id}`)
        .send({ estado: 'COMPLETADO' }),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(403);
    // La informacion del examen no cambio.
    const examen = await entorno.gateways.examenGateway.obtenerPorId(escenario.examen.id);
    expect(examen.estado).toBe('PENDIENTE');
  });

  test('un paciente NO puede eliminar un examen (403)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).delete(`/api/v1/examenes/${escenario.examen.id}`),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(403);
    expect(await entorno.gateways.examenGateway.obtenerPorId(escenario.examen.id)).not.toBeNull();
  });

  test('un paciente NO puede crear ni editar pacientes (403)', async () => {
    const creacion = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '20347024-K', nombres: 'Falso', apellidos: 'Registro' }),
      sesiones.paciente,
    );
    expect(creacion.status).toBe(403);

    const edicion = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/pacientes/${escenario.paciente.id}`)
        .send({ telefono: '+56900000000' }),
      sesiones.paciente,
    );
    expect(edicion.status).toBe(403);
  });

  test('un paciente NO puede administrar usuarios ni leer la auditoria (403, RB-2)', async () => {
    const usuarios = await comoAutorizado(
      request(entorno.app).get('/api/v1/usuarios'),
      sesiones.paciente,
    );
    expect(usuarios.status).toBe(403);

    const auditoria = await comoAutorizado(
      request(entorno.app).get('/api/v1/auditoria'),
      sesiones.paciente,
    );
    expect(auditoria.status).toBe(403);
  });

  test('un medico SI puede crear examenes de cualquier paciente (RB-3)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.otroPaciente.id, tipo: 'Radiografia de torax' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.medicoId).toBe(escenario.medico.id);
  });

  test('un medico NO puede administrar usuarios: eso es exclusivo del admin (RB-2)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/usuarios'),
      sesiones.medico,
    );
    expect(respuesta.status).toBe(403);
  });
});

describe('CP-SEG-02 · Acceso a datos de terceros / IDOR (RB-1, OWASP A01)', () => {
  test('un paciente NO accede a la ficha de otro paciente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.otroPaciente.id}`),
      sesiones.paciente,
    );

    // 404 y no 403: no se confirma la existencia de una ficha ajena.
    expect(respuesta.status).toBe(404);
  });

  test('un paciente NO lista los examenes de otro paciente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.otroPaciente.id}/examenes`),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(404);
  });

  test('un paciente NO accede a un examen ajeno por su id directo', async () => {
    const examenAjeno = await entorno.gateways.examenGateway.crear({
      pacienteId: escenario.otroPaciente.id,
      tipo: 'Resonancia',
      eliminadoEn: null,
    });

    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/examenes/${examenAjeno.id}`),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(404);
  });

  test('el listado de pacientes de un paciente contiene SOLO su propia ficha', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/pacientes'),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0].id).toBe(escenario.paciente.id);
  });

  test('un medico SI ve el listado completo de pacientes (RB-3)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/pacientes'),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.length).toBeGreaterThanOrEqual(2);
  });

  test('un paciente SI accede a su propia ficha y a sus propios examenes (RF-4.1)', async () => {
    const ficha = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.paciente.id}`),
      sesiones.paciente,
    );
    expect(ficha.status).toBe(200);

    const examenes = await comoAutorizado(
      request(entorno.app).get(`/api/v1/pacientes/${escenario.paciente.id}/examenes`),
      sesiones.paciente,
    );
    expect(examenes.status).toBe(200);
    expect(examenes.body).toHaveLength(1);
  });
});

describe('CP-SEG-03 · Resistencia a inyeccion y a mass assignment (NFR-SEG-5)', () => {
  test('un payload de inyeccion SQL en el RUT se rechaza como dato invalido', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: "12345678-5'; DROP TABLE paciente;--", nombres: 'Ana', apellidos: 'Perez' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
    // La tabla sigue operativa: el listado responde con normalidad.
    const listado = await comoAutorizado(
      request(entorno.app).get('/api/v1/pacientes'),
      sesiones.medico,
    );
    expect(listado.status).toBe(200);
  });

  test('un payload XSS almacenado se devuelve tal cual, sin interpretarse como HTML', async () => {
    const payload = '<script>alert(1)</script>';
    const creado = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Hemograma', descripcion: payload }),
      sesiones.medico,
    );
    expect(creado.status).toBe(201);

    const leido = await comoAutorizado(
      request(entorno.app).get(`/api/v1/examenes/${creado.body.id}`),
      sesiones.medico,
    );

    // La API es JSON: devuelve el texto como dato, con Content-Type que el
    // navegador no interpreta como documento. La defensa de renderizado esta
    // en la SPA, que nunca usa dangerouslySetInnerHTML.
    expect(leido.headers['content-type']).toContain('application/json');
    expect(leido.body.descripcion).toBe(payload);
  });

  test('un campo no declarado en el esquema hace fallar la peticion (mass assignment)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Rx', medicoId: 9999, eliminadoEn: null }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('un cuerpo JSON desmedido se rechaza (limite de 100 kb)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Rx', descripcion: 'x'.repeat(200_000) }),
      sesiones.medico,
    );

    expect([400, 413]).toContain(respuesta.status);
  });
});

describe('CP-INT-05 · Unicidad de RUT del paciente (INC-01)', () => {
  test('rechaza con 409 un RUT ya registrado', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '12345678-5', nombres: 'Otra', apellidos: 'Persona' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe('DUPLICADO');
  });

  test('rechaza el MISMO RUT escrito con puntos: la normalizacion lo detecta', async () => {
    // Este es el assert que falla en la version 1.0 y origina el incidente
    // INC-01: alli la comparacion era textual y "12.345.678-5" pasaba.
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '12.345.678-5', nombres: 'Otra', apellidos: 'Persona' }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(409);
  });

  test('un duplicado devuelve 409 y no un 500 opaco', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/pacientes')
        .send({ rut: '12345678-5', nombres: 'Otra', apellidos: 'Persona' }),
      sesiones.medico,
    );

    expect(respuesta.status).not.toBe(500);
  });
});

describe('CP-INT-01 a CP-INT-03 · Documentos clinicos (RF-4.2 a RF-4.4)', () => {
  test('el medico adjunta un PDF y queda referenciado en la base (RF-4.3, RF-4.4)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
        .attach('archivo', pdfDePrueba(), {
          filename: 'informe.pdf',
          contentType: 'application/pdf',
        }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.rutaStorage).toBeDefined();
    expect(respuesta.body.mime).toBe('application/pdf');
    // La base guarda la referencia, no el binario.
    expect(respuesta.body.contenido).toBeUndefined();
  });

  test('CP-SEG-07 · rechaza un ejecutable que se declara PDF (NFR-SEG-12)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
        .attach('archivo', ejecutableDisfrazado(), {
          filename: 'informe.pdf',
          contentType: 'application/pdf',
        }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.mensaje).toContain('no corresponde al tipo declarado');
  });

  test('rechaza un tipo MIME fuera de la lista blanca', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
        .attach('archivo', Buffer.from('<html>x</html>'), {
          filename: 'pagina.html',
          contentType: 'text/html',
        }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(400);
  });

  test('el paciente titular descarga su documento y la descarga queda auditada (RF-4.2)', async () => {
    const documento = (
      await comoAutorizado(
        request(entorno.app)
          .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
          .attach('archivo', pdfDePrueba(), {
            filename: 'informe.pdf',
            contentType: 'application/pdf',
          }),
        sesiones.medico,
      )
    ).body;

    const descarga = await comoAutorizado(
      request(entorno.app).get(`/api/v1/documentos/${documento.id}/descarga`),
      sesiones.paciente,
    );

    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-disposition']).toContain('attachment');
    expect(descarga.headers['x-content-type-options']).toBe('nosniff');

    const registros = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.DESCARGAR_DOCUMENTO,
    });
    expect(registros).toHaveLength(1);
  });

  test('otro paciente NO descarga el documento ajeno (RB-1)', async () => {
    const documento = (
      await comoAutorizado(
        request(entorno.app)
          .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
          .attach('archivo', pdfDePrueba(), {
            filename: 'informe.pdf',
            contentType: 'application/pdf',
          }),
        sesiones.medico,
      )
    ).body;

    const respuesta = await comoAutorizado(
      request(entorno.app).get(`/api/v1/documentos/${documento.id}/descarga`),
      sesiones.otroPaciente,
    );

    expect(respuesta.status).toBe(404);
  });

  test('un paciente NO puede adjuntar documentos (403, RB-1)', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
        .attach('archivo', pdfDePrueba(), {
          filename: 'informe.pdf',
          contentType: 'application/pdf',
        }),
      sesiones.paciente,
    );

    expect(respuesta.status).toBe(403);
  });

  test('el nombre del archivo se sanea: no conserva componentes de ruta', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .post(`/api/v1/examenes/${escenario.examen.id}/documentos`)
        .attach('archivo', pdfDePrueba(), {
          filename: '../../etc/passwd.pdf',
          contentType: 'application/pdf',
        }),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.nombreArchivo).not.toContain('..');
    expect(respuesta.body.nombreArchivo).not.toContain('/');
  });
});

describe('CP-INT-04 · Eliminacion logica y auditoria (RF-3.3, RF-5.1)', () => {
  test('la eliminacion de un examen es LOGICA: el registro permanece', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).delete(`/api/v1/examenes/${escenario.examen.id}`),
      sesiones.medico,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.logica).toBe(true);

    // Ya no aparece entre los activos...
    expect(await entorno.gateways.examenGateway.obtenerPorId(escenario.examen.id)).toBeNull();
    // ...pero sigue existiendo en el almacenamiento, con su marca de baja.
    const conEliminados = entorno.gateways.examenGateway.obtenerIncluyendoEliminados(
      escenario.examen.id,
    );
    expect(conEliminados).not.toBeNull();
    expect(conEliminados.eliminadoEn).not.toBeNull();
  });

  test('cada accion critica genera un registro de auditoria (RF-5.1)', async () => {
    await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Ecografia' }),
      sesiones.medico,
    );
    await comoAutorizado(
      request(entorno.app).delete(`/api/v1/examenes/${escenario.examen.id}`),
      sesiones.medico,
    );

    const acciones = (await entorno.gateways.auditoriaGateway.listar({ limite: 500 })).map(
      (registro) => registro.accion,
    );
    expect(acciones).toContain(ACCIONES_AUDITABLES.CREAR_EXAMEN);
    expect(acciones).toContain(ACCIONES_AUDITABLES.ELIMINAR_EXAMEN);
  });

  test('el administrador consulta y exporta la auditoria (RF-5.2)', async () => {
    const listado = await comoAutorizado(
      request(entorno.app).get('/api/v1/auditoria'),
      sesiones.admin,
    );
    expect(listado.status).toBe(200);
    expect(Array.isArray(listado.body)).toBe(true);

    const exportacion = await comoAutorizado(
      request(entorno.app).get('/api/v1/auditoria/exportar'),
      sesiones.admin,
    );
    expect(exportacion.status).toBe(200);
    expect(exportacion.body).toHaveProperty('generadoEn');
    expect(exportacion.body).toHaveProperty('total');
  });

  test('cada registro de auditoria identifica usuario, accion y entidad', async () => {
    const creado = await comoAutorizado(
      request(entorno.app)
        .post('/api/v1/examenes')
        .send({ pacienteId: escenario.paciente.id, tipo: 'Ecografia' }),
      sesiones.medico,
    );

    const [registro] = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.CREAR_EXAMEN,
    });
    expect(registro.usuarioId).toBe(escenario.medico.id);
    expect(registro.entidad).toBe('examen');
    expect(registro.entidadId).toBe(creado.body.id);
    expect(registro.creadoEn).toBeDefined();
  });
});

describe('Administracion de usuarios (RF-2.5 a RF-2.7, RB-2)', () => {
  test('el admin lista, crea, edita el rol y elimina usuarios', async () => {
    const listado = await comoAutorizado(
      request(entorno.app).get('/api/v1/usuarios'),
      sesiones.admin,
    );
    expect(listado.status).toBe(200);

    const creado = await comoAutorizado(
      request(entorno.app).post('/api/v1/usuarios').send({
        nombreUsuario: 'medico2',
        email: 'medico2@cuidarte.test',
        password: 'Cuidarte2026!',
        rol: 'MEDICO',
      }),
      sesiones.admin,
    );
    expect(creado.status).toBe(201);

    const editado = await comoAutorizado(
      request(entorno.app).put(`/api/v1/usuarios/${creado.body.id}`).send({ rol: 'ADMIN' }),
      sesiones.admin,
    );
    expect(editado.status).toBe(200);
    expect(editado.body.rol).toBe('ADMIN');

    const eliminado = await comoAutorizado(
      request(entorno.app).delete(`/api/v1/usuarios/${creado.body.id}`),
      sesiones.admin,
    );
    expect(eliminado.status).toBe(200);
  }, 30_000);

  test('el admin no puede eliminar su propia cuenta ni degradar su rol', async () => {
    const autoEliminacion = await comoAutorizado(
      request(entorno.app).delete(`/api/v1/usuarios/${escenario.admin.id}`),
      sesiones.admin,
    );
    expect(autoEliminacion.status).toBe(409);

    const autoDegradacion = await comoAutorizado(
      request(entorno.app).put(`/api/v1/usuarios/${escenario.admin.id}`).send({ rol: 'PACIENTE' }),
      sesiones.admin,
    );
    expect(autoDegradacion.status).toBe(409);
  });

  test('rechaza un rol inexistente con 400', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app)
        .put(`/api/v1/usuarios/${escenario.medico.id}`)
        .send({ rol: 'SUPERADMIN' }),
      sesiones.admin,
    );
    expect(respuesta.status).toBe(400);
  });

  test('responde 404 ante un usuario inexistente', async () => {
    const respuesta = await comoAutorizado(
      request(entorno.app).get('/api/v1/usuarios/99999'),
      sesiones.admin,
    );
    expect(respuesta.status).toBe(404);
  });
});
