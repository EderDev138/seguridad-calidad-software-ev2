import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { NoAutenticado } from '../../domain/error/errors.js';

/**
 * Servicio de tokens JWT (ERS RF-1.1, RF-1.2, NFR-SEG-9).
 *
 * Decisiones de seguridad:
 *  - El secreto se lee de variable de entorno, nunca del codigo (NFR-SEG-13).
 *    Si falta, el arranque falla: es preferible no arrancar que arrancar con un
 *    secreto por defecto conocido.
 *  - Se fija explicitamente el algoritmo al firmar y al verificar, para cerrar
 *    el ataque de confusion de algoritmo (`alg: none` / HS256-vs-RS256).
 *  - Cada token lleva un `jti` unico, que es lo que permite revocarlo en el
 *    logout sin esperar su expiracion (RF-1.2).
 */
const ALGORITMO = 'HS256';

/** Vigencia corta del token de acceso, como pide el ERS §3.1.2. */
export const VIGENCIA_ACCESO = process.env.JWT_VIGENCIA_ACCESO ?? '15m';
export const VIGENCIA_REFRESH = process.env.JWT_VIGENCIA_REFRESH ?? '8h';

function secretoDeAcceso() {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      'JWT_SECRET ausente o demasiado corto (minimo 32 caracteres). ' +
        'Definalo como variable de entorno; no debe estar en el codigo (NFR-SEG-13).',
    );
  }
  return secreto;
}

function secretoDeRefresh() {
  return process.env.JWT_REFRESH_SECRET ?? secretoDeAcceso();
}

/**
 * Firma un token de acceso para un usuario autenticado.
 *
 * El payload lleva solo el identificador y el rol: ningun dato personal viaja
 * en el token, que es legible por cualquiera que lo intercepte (minimizacion,
 * Ley 19.628 / 21.719).
 */
export function firmarAcceso(usuario) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(usuario.id), rol: usuario.rol, jti, tipo: 'acceso' },
    secretoDeAcceso(),
    {
      algorithm: ALGORITMO,
      expiresIn: VIGENCIA_ACCESO,
    },
  );
  return { token, jti };
}

export function firmarRefresh(usuario) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(usuario.id), jti, tipo: 'refresh' }, secretoDeRefresh(), {
    algorithm: ALGORITMO,
    expiresIn: VIGENCIA_REFRESH,
  });
  return { token, jti };
}

/**
 * Verifica y decodifica un token.
 *
 * @param {string} token
 * @param {'acceso'|'refresh'} tipoEsperado
 * @throws {NoAutenticado} si el token es invalido, expirado o de otro tipo
 */
export function verificar(token, tipoEsperado = 'acceso') {
  const secreto = tipoEsperado === 'refresh' ? secretoDeRefresh() : secretoDeAcceso();
  let payload;
  try {
    payload = jwt.verify(token, secreto, { algorithms: [ALGORITMO] });
  } catch (error) {
    throw new NoAutenticado(
      error.name === 'TokenExpiredError' ? 'La sesion expiro' : 'Token invalido',
    );
  }
  if (payload.tipo !== tipoEsperado) {
    throw new NoAutenticado('Tipo de token incorrecto');
  }
  return payload;
}

/** Extrae el bearer token de la cabecera Authorization. */
export function extraerBearer(cabecera) {
  if (typeof cabecera !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(cabecera.trim());
  return match ? match[1] : null;
}
