import { describe, test, expect } from '@jest/globals';

process.env.BCRYPT_COST = '12';

const { validarPolitica, hashear, verificar, costoDelHash, COSTO_BCRYPT, POLITICA_PASSWORD } =
  await import('../../src/infrastructure/security/password.js');
const { DatosInvalidos } = await import('../../src/domain/error/errors.js');

/**
 * CP-FUN-09 / CP-SEG-04 · Politica de contrasenas y hashing.
 *
 * Verifica los dos controles criptograficos que el ERS exige en el backend:
 * la politica de contrasenas (§2.4, RF-1.4) y el hashing con bcrypt de costo
 * suficiente (NFR-SEG-2). El segundo es el que estaba debilitado en la
 * version 1.0 (incidente INC-03).
 */

describe('CP-FUN-09 · Politica de contrasenas (RF-1.4, ERS §2.4)', () => {
  test('acepta una contrasena que cumple todas las reglas', () => {
    expect(validarPolitica('Cuidarte2026!')).toBe(true);
  });

  test('rechaza por longitud insuficiente', () => {
    expect(() => validarPolitica('Abc1!')).toThrow(DatosInvalidos);
  });

  test('rechaza por falta de mayuscula, minuscula, numero o simbolo', () => {
    expect(() => validarPolitica('cuidarte2026!')).toThrow(DatosInvalidos);
    expect(() => validarPolitica('CUIDARTE2026!')).toThrow(DatosInvalidos);
    expect(() => validarPolitica('CuidartePlus!')).toThrow(DatosInvalidos);
    expect(() => validarPolitica('Cuidarte20266')).toThrow(DatosInvalidos);
  });

  test('rechaza valores que no son texto', () => {
    expect(() => validarPolitica(undefined)).toThrow(DatosInvalidos);
    expect(() => validarPolitica(12345678901234)).toThrow(DatosInvalidos);
  });

  test('el error enumera TODAS las reglas incumplidas, no solo la primera', () => {
    // Un mensaje que solo reporta el primer problema obliga al usuario a
    // reintentar varias veces (NFR-USAB-3, mensajes de error amigables).
    try {
      validarPolitica('abc');
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(DatosInvalidos);
      expect(error.detalle).toHaveLength(4);
    }
  });

  test('el largo minimo es configurable y por defecto es 12 (ERS §2.4)', () => {
    expect(POLITICA_PASSWORD.largoMinimo).toBe(12);
  });
});

describe('CP-SEG-04 · Hashing bcrypt (NFR-SEG-2)', () => {
  test('el factor de costo es al menos 12', () => {
    // Umbral de OWASP Password Storage. La version 1.0 usaba 8.
    expect(COSTO_BCRYPT).toBeGreaterThanOrEqual(12);
  });

  test('el hash generado no contiene la contrasena y verifica correctamente', async () => {
    const hash = await hashear('Cuidarte2026!');
    expect(hash).not.toContain('Cuidarte2026!');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verificar('Cuidarte2026!', hash)).toBe(true);
    expect(await verificar('otra-clave-distinta', hash)).toBe(false);
  }, 20_000);

  test('dos hashes de la misma contrasena son distintos (salt aleatorio)', async () => {
    const [primero, segundo] = await Promise.all([
      hashear('Cuidarte2026!'),
      hashear('Cuidarte2026!'),
    ]);
    expect(primero).not.toBe(segundo);
  }, 20_000);

  test('el costo embebido en el hash es el configurado', async () => {
    const hash = await hashear('Cuidarte2026!');
    expect(costoDelHash(hash)).toBe(COSTO_BCRYPT);
  }, 20_000);

  test('costoDelHash devuelve null ante un valor que no es un hash bcrypt', () => {
    expect(costoDelHash('texto-plano')).toBeNull();
    expect(costoDelHash(undefined)).toBeNull();
  });

  test('verificar devuelve false si no hay hash almacenado', async () => {
    // Evita que una cuenta sin hash (dato corrupto) autentique a cualquiera.
    expect(await verificar('cualquier-cosa', null)).toBe(false);
    expect(await verificar('cualquier-cosa', '')).toBe(false);
  });
});
