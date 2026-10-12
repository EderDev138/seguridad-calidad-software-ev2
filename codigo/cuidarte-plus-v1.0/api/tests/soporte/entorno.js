/**
 * Soporte compartido de las pruebas.
 *
 * Arma la aplicacion completa con gateways en memoria y storage en memoria,
 * de modo que las pruebas ejerzan la MISMA logica de negocio y los MISMOS
 * middlewares de seguridad que el servicio en QA, sin depender de PostgreSQL.
 *
 * Las variables de entorno se fijan aqui porque los modulos de seguridad las
 * leen al importarse (fallo rapido si faltan).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'secreto-de-pruebas-solo-para-qa-32-caracteres-minimo';
process.env.JWT_REFRESH_SECRET ??= 'secreto-refresh-de-pruebas-solo-para-qa-32-caracteres';
// Costo minimo permitido por NFR-SEG-2; se mantiene en 12 para que las pruebas
// validen el control real y no una configuracion debilitada.
process.env.BCRYPT_COST ??= '12';
process.env.LOG_LEVEL ??= 'silent';
process.env.RATE_LIMIT_AUTH ??= '1000';
process.env.RATE_LIMIT_GENERAL ??= '100000';
process.env.CORS_ORIGENES ??= 'http://localhost:5173';

const { crearApp, crearCasosDeUso } = await import('../../src/app.js');
const { crearGatewaysEnMemoria } =
  await import('../../src/infrastructure/adapters/memory/gatewaysMemoria.js');
const { StorageMemoria } = await import('../../src/infrastructure/storage/StorageLocal.js');
const { Usuario } = await import('../../src/domain/model/Usuario.js');
const { ROLES } = await import('../../src/domain/model/roles.js');
const password = await import('../../src/infrastructure/security/password.js');

/** Contrasena de prueba que cumple la politica (12+, mayus, minus, numero, simbolo). */
export const PASSWORD_VALIDA = 'Cuidarte2026!';

/**
 * Levanta un entorno de pruebas aislado.
 *
 * @returns {Promise<{app: import('express').Express, gateways: object, casosDeUso: object, storage: object}>}
 */
export async function crearEntorno() {
  const gateways = crearGatewaysEnMemoria();
  const storage = new StorageMemoria();
  const casosDeUso = crearCasosDeUso({ gateways, storage });
  const app = crearApp({ casosDeUso, gateways });
  return { app, gateways, casosDeUso, storage };
}

/**
 * Siembra un usuario con el rol indicado directamente por el gateway.
 * Se evita pasar por la API para que las pruebas de un modulo no dependan del
 * correcto funcionamiento de otro.
 */
export async function sembrarUsuario(gateways, { nombreUsuario, rol, email, clave } = {}) {
  const usuario = new Usuario({
    nombreUsuario: nombreUsuario ?? `usuario-${rol?.toLowerCase() ?? 'x'}`,
    email: email ?? `${nombreUsuario ?? rol}@cuidarte.test`,
    passwordHash: await password.hashear(clave ?? PASSWORD_VALIDA),
    rol: rol ?? ROLES.PACIENTE,
  });
  return gateways.usuarioGateway.crear(usuario);
}

/** Obtiene un token de acceso valido para un usuario ya sembrado. */
export async function iniciarSesion(app, request, nombreUsuario, clave = PASSWORD_VALIDA) {
  const respuesta = await request(app)
    .post('/api/v1/auth/login')
    .send({ nombreUsuario, password: clave });
  if (respuesta.status !== 200) {
    throw new Error(
      `No fue posible iniciar sesion como ${nombreUsuario}: ${respuesta.status} ${JSON.stringify(respuesta.body)}`,
    );
  }
  return respuesta.body;
}

/**
 * Siembra el escenario tipico de las pruebas: un administrador, un medico, un
 * paciente con cuenta vinculada a su ficha y un examen con un documento.
 */
export async function sembrarEscenarioClinico(gateways) {
  const admin = await sembrarUsuario(gateways, { nombreUsuario: 'admin1', rol: ROLES.ADMIN });
  const medico = await sembrarUsuario(gateways, { nombreUsuario: 'medico1', rol: ROLES.MEDICO });
  const cuentaPaciente = await sembrarUsuario(gateways, {
    nombreUsuario: 'paciente1',
    rol: ROLES.PACIENTE,
  });
  const otraCuentaPaciente = await sembrarUsuario(gateways, {
    nombreUsuario: 'paciente2',
    rol: ROLES.PACIENTE,
  });

  const paciente = await gateways.pacienteGateway.crear({
    rut: '12345678-5',
    nombres: 'Ana',
    apellidos: 'Perez',
    usuarioId: cuentaPaciente.id,
    eliminadoEn: null,
  });

  const otroPaciente = await gateways.pacienteGateway.crear({
    rut: '11111111-1',
    nombres: 'Bruno',
    apellidos: 'Soto',
    usuarioId: otraCuentaPaciente.id,
    eliminadoEn: null,
  });

  const examen = await gateways.examenGateway.crear({
    pacienteId: paciente.id,
    tipo: 'Hemograma',
    descripcion: 'Control anual',
    medicoId: medico.id,
    estado: 'PENDIENTE',
    eliminadoEn: null,
  });

  return { admin, medico, cuentaPaciente, otraCuentaPaciente, paciente, otroPaciente, examen };
}

/** PDF minimo valido: empieza por la firma %PDF, que es lo que valida el dominio. */
export function pdfDePrueba() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');
}

/** Archivo que miente sobre su tipo: se declara PDF pero su contenido no lo es. */
export function ejecutableDisfrazado() {
  return Buffer.from('MZ\x90\x00\x03\x00\x00\x00ejecutable-windows', 'binary');
}
