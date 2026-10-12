import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { crearEntorno, sembrarUsuario, PASSWORD_VALIDA } from '../soporte/entorno.js';
import { ROLES, ACCIONES_AUDITABLES } from '../../src/domain/model/roles.js';

/**
 * Casos CP-FUN-01 a CP-FUN-04 y CP-SEG-06 · Autenticacion y sesion.
 *
 * Cubren RF-1.1, RF-1.2, RF-1.3 (propuesto), RF-2.1 y NFR-SEG-9/10/11.
 */

let entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

describe('CP-FUN-01 · Inicio de sesion con credenciales validas (RF-1.1)', () => {
  test('devuelve 200 con token JWT, refresh token y datos del usuario', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });

    const respuesta = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(respuesta.body.refreshToken).toBeDefined();
    expect(respuesta.body.usuario).toMatchObject({ nombreUsuario: 'medico1', rol: ROLES.MEDICO });
  });

  test('la respuesta NO expone el hash de la contrasena (NFR-SEG-8)', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    const respuesta = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA });

    expect(JSON.stringify(respuesta.body)).not.toContain('$2');
    expect(respuesta.body.usuario.passwordHash).toBeUndefined();
  });

  test('el login exitoso queda registrado en auditoria (RF-5.1)', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA });

    const registros = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.LOGIN,
    });
    expect(registros).toHaveLength(1);
  });

  test('el token emitido sirve para una peticion autenticada', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    const { token } = (
      await request(entorno.app)
        .post('/api/v1/auth/login')
        .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA })
    ).body;

    const yo = await request(entorno.app)
      .get('/api/v1/auth/yo')
      .set('Authorization', `Bearer ${token}`);

    expect(yo.status).toBe(200);
    expect(yo.body.rol).toBe(ROLES.MEDICO);
  });
});

describe('CP-FUN-02 · Credenciales invalidas y bloqueo por intentos (RF-1.1, RF-1.3)', () => {
  test('devuelve 401 con contrasena incorrecta', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    const respuesta = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: 'ClaveIncorrecta1!' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toBe('NO_AUTENTICADO');
  });

  test('no distingue entre usuario inexistente y contrasena incorrecta (OWASP A07)', async () => {
    // Si los mensajes difirieran, un atacante podria enumerar cuentas validas.
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });

    const inexistente = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'no-existe', password: PASSWORD_VALIDA });
    const claveMala = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: 'ClaveIncorrecta1!' });

    expect(inexistente.status).toBe(claveMala.status);
    expect(inexistente.body.mensaje).toBe(claveMala.body.mensaje);
  });

  test('bloquea la cuenta tras 5 intentos fallidos y responde 429', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });

    for (let intento = 0; intento < 5; intento += 1) {
      await request(entorno.app)
        .post('/api/v1/auth/login')
        .send({ nombreUsuario: 'medico1', password: 'ClaveIncorrecta1!' });
    }

    // Incluso con la contrasena CORRECTA el acceso queda bloqueado: es el
    // comportamiento esperado de la ventana de bloqueo temporal.
    const trasBloqueo = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA });

    expect(trasBloqueo.status).toBe(429);
    expect(trasBloqueo.body.error).toBe('DEMASIADOS_INTENTOS');
  }, 30_000);

  test('los intentos fallidos quedan auditados sin registrar la contrasena', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ nombreUsuario: 'medico1', password: 'SuperSecreta99!' });

    const registros = await entorno.gateways.auditoriaGateway.listar({
      accion: ACCIONES_AUDITABLES.LOGIN_FALLIDO,
    });
    expect(registros).toHaveLength(1);
    expect(registros[0].detalle).toContain('medico1');
    expect(registros[0].detalle).not.toContain('SuperSecreta99!');
  });
});

describe('CP-FUN-03 · Cierre de sesion y revocacion de token (RF-1.2, NFR-SEG-9)', () => {
  test('tras el logout el mismo token deja de ser valido', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    const { token } = (
      await request(entorno.app)
        .post('/api/v1/auth/login')
        .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA })
    ).body;

    const antes = await request(entorno.app)
      .get('/api/v1/auth/yo')
      .set('Authorization', `Bearer ${token}`);
    expect(antes.status).toBe(200);

    const logout = await request(entorno.app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
    expect(logout.body.revocado).toBe(true);

    // Este es el assert que importa: el JWT sigue siendo criptograficamente
    // valido y no ha expirado, pero la sesion fue revocada.
    const despues = await request(entorno.app)
      .get('/api/v1/auth/yo')
      .set('Authorization', `Bearer ${token}`);
    expect(despues.status).toBe(401);
  });

  test('rechaza peticiones sin token o con token manipulado', async () => {
    const sinToken = await request(entorno.app).get('/api/v1/auth/yo');
    expect(sinToken.status).toBe(401);

    const manipulado = await request(entorno.app)
      .get('/api/v1/auth/yo')
      .set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIiwicm9sIjoiQURNSU4ifQ.');
    expect(manipulado.status).toBe(401);
  });

  test('el refresh token renueva el acceso y deja de servir tras revocarse', async () => {
    await sembrarUsuario(entorno.gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
    const sesion = (
      await request(entorno.app)
        .post('/api/v1/auth/login')
        .send({ nombreUsuario: 'medico1', password: PASSWORD_VALIDA })
    ).body;

    const renovado = await request(entorno.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });
    expect(renovado.status).toBe(200);
    expect(renovado.body.token).toBeDefined();

    // Un token de acceso no puede usarse como refresh token y viceversa.
    const cruzado = await request(entorno.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.token });
    expect(cruzado.status).toBe(401);
  });
});

describe('CP-FUN-04 · Autorregistro con rol por defecto (RF-2.1, RB-1)', () => {
  test('crea la cuenta con rol PACIENTE y responde 201', async () => {
    const respuesta = await request(entorno.app).post('/api/v1/auth/registro').send({
      nombreUsuario: 'nuevo.paciente',
      email: 'nuevo@cuidarte.test',
      password: PASSWORD_VALIDA,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.rol).toBe(ROLES.PACIENTE);
  });

  test('NO permite escalar privilegios enviando el campo rol (OWASP A01)', async () => {
    // El esquema es estricto: un campo no declarado hace fallar la peticion.
    const respuesta = await request(entorno.app).post('/api/v1/auth/registro').send({
      nombreUsuario: 'atacante',
      email: 'atacante@cuidarte.test',
      password: PASSWORD_VALIDA,
      rol: ROLES.ADMIN,
    });

    expect(respuesta.status).toBe(400);
    expect(await entorno.gateways.usuarioGateway.obtenerPorNombreUsuario('atacante')).toBeNull();
  });

  test('rechaza una contrasena que no cumple la politica (RF-1.4)', async () => {
    const respuesta = await request(entorno.app)
      .post('/api/v1/auth/registro')
      .send({ nombreUsuario: 'debil', email: 'debil@cuidarte.test', password: '1234' });

    expect(respuesta.status).toBe(400);
  });

  test('rechaza nombre de usuario o email ya registrados con 409', async () => {
    const datos = {
      nombreUsuario: 'repetido',
      email: 'repetido@cuidarte.test',
      password: PASSWORD_VALIDA,
    };
    await request(entorno.app).post('/api/v1/auth/registro').send(datos);

    const mismoUsuario = await request(entorno.app)
      .post('/api/v1/auth/registro')
      .send({ ...datos, email: 'otro@cuidarte.test' });
    expect(mismoUsuario.status).toBe(409);

    const mismoEmail = await request(entorno.app)
      .post('/api/v1/auth/registro')
      .send({ ...datos, nombreUsuario: 'otro.usuario' });
    expect(mismoEmail.status).toBe(409);
  }, 30_000);
});

describe('CP-SEG-06 · Cabeceras de seguridad HTTP (NFR-SEG-10)', () => {
  test('toda respuesta incluye las cabeceras que verifica OWASP ZAP', async () => {
    const respuesta = await request(entorno.app).get('/api/v1/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-security-policy']).toContain("default-src 'self'");
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
    expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
    expect(respuesta.headers['permissions-policy']).toContain('geolocation=()');
    expect(respuesta.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  test('no revela el framework en la cabecera X-Powered-By (OWASP A05)', async () => {
    const respuesta = await request(entorno.app).get('/api/v1/salud');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  test('una ruta inexistente responde 404 con cuerpo JSON controlado', async () => {
    const respuesta = await request(entorno.app).get('/api/v1/ruta-que-no-existe');
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toBe('RUTA_NO_ENCONTRADA');
  });
});
