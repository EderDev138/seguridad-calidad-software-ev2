import bcrypt from 'bcryptjs';
import { DatosInvalidos } from '../../domain/error/errors.js';

/**
 * Factor de costo de bcrypt (NFR-SEG-2).
 *
 * 12 es el minimo recomendado por OWASP Password Storage Cheat Sheet para
 * bcrypt. La version 1.0 del software usaba 8, lo que reduce el costo de un
 * ataque de fuerza bruta offline en aproximadamente 16 veces: ese es el
 * incidente INC-03 documentado en el informe.
 */
export const COSTO_BCRYPT = Number(process.env.BCRYPT_COST ?? 12);

/** Minimo absoluto aceptado; por debajo de esto el arranque falla. */
const COSTO_MINIMO_ACEPTADO = 12;

if (COSTO_BCRYPT < COSTO_MINIMO_ACEPTADO) {
  throw new Error(
    `BCRYPT_COST=${COSTO_BCRYPT} es inseguro. Minimo exigido por NFR-SEG-2: ${COSTO_MINIMO_ACEPTADO}`,
  );
}

/**
 * Politica de contrasenas (ERS §2.4, RF-1.4).
 *
 * Los valores son configurables por variable de entorno, como exige la
 * restriccion del ERS ("minimo configurable, por defecto 12 caracteres").
 */
export const POLITICA_PASSWORD = Object.freeze({
  largoMinimo: Number(process.env.PASSWORD_LARGO_MINIMO ?? 12),
  exigeMayuscula: true,
  exigeMinuscula: true,
  exigeNumero: true,
  exigeSimbolo: true,
});

/**
 * Valida una contrasena contra la politica. Se ejecuta SIEMPRE en el servidor:
 * la validacion del formulario en React es ayuda de usabilidad, no un control
 * de seguridad (NFR-SEG-4).
 *
 * @param {string} password
 * @throws {DatosInvalidos} con el detalle de todas las reglas incumplidas
 */
/**
 * Reglas de composicion, declaradas como datos.
 *
 * Expresarlas en una tabla en vez de en una cadena de `if` mantiene la
 * complejidad ciclomatica baja (ISO/IEC 25010, mantenibilidad) y permite
 * agregar una regla nueva sin tocar la logica de validacion.
 */
const REGLAS_COMPOSICION = [
  { activa: () => POLITICA_PASSWORD.exigeMayuscula, patron: /[A-Z]/, falta: 'una letra mayuscula' },
  { activa: () => POLITICA_PASSWORD.exigeMinuscula, patron: /[a-z]/, falta: 'una letra minuscula' },
  { activa: () => POLITICA_PASSWORD.exigeNumero, patron: /[0-9]/, falta: 'un numero' },
  { activa: () => POLITICA_PASSWORD.exigeSimbolo, patron: /[^A-Za-z0-9]/, falta: 'un simbolo' },
];

export function validarPolitica(password) {
  const valor = typeof password === 'string' ? password : '';
  const faltas = [];

  if (valor.length < POLITICA_PASSWORD.largoMinimo) {
    faltas.push(`debe tener al menos ${POLITICA_PASSWORD.largoMinimo} caracteres`);
  }

  for (const regla of REGLAS_COMPOSICION) {
    if (regla.activa() && !regla.patron.test(valor)) {
      faltas.push(`debe incluir al menos ${regla.falta}`);
    }
  }

  if (faltas.length > 0) {
    throw new DatosInvalidos('La contrasena no cumple la politica de seguridad', faltas);
  }
  return true;
}

/** Genera el hash bcrypt de una contrasena ya validada (NFR-SEG-2). */
export async function hashear(password) {
  return bcrypt.hash(password, COSTO_BCRYPT);
}

/**
 * Compara una contrasena con su hash.
 *
 * `bcrypt.compare` es de tiempo constante respecto del hash, lo que evita
 * filtrar informacion por diferencias de tiempo de respuesta.
 */
export async function verificar(password, hash) {
  if (!hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/** Extrae el factor de costo de un hash bcrypt existente (usado por CP-SEG-04). */
export function costoDelHash(hash) {
  const match = /^\$2[aby]?\$(\d{2})\$/.exec(hash ?? '');
  return match ? Number(match[1]) : null;
}
