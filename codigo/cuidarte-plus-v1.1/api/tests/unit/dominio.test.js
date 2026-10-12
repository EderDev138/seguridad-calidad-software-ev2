import { describe, test, expect } from '@jest/globals';
import { Paciente, normalizarRut } from '../../src/domain/model/Paciente.js';
import { Examen, ESTADOS_EXAMEN } from '../../src/domain/model/Examen.js';
import { Documento, firmaCoincide, TAMANO_MAXIMO_BYTES } from '../../src/domain/model/Documento.js';
import { Usuario } from '../../src/domain/model/Usuario.js';
import { ROLES } from '../../src/domain/model/roles.js';
import { DatosInvalidos } from '../../src/domain/error/errors.js';

/**
 * Pruebas unitarias del dominio.
 *
 * Validan las invariantes del nucleo sin Express, sin base de datos y sin red:
 * si una de estas falla, el defecto esta en la regla de negocio y no en la
 * infraestructura. Es la base de la piramide de pruebas.
 */

describe('CP-FUN-05 · Normalizacion y validacion del RUT (RB nueva, INC-01)', () => {
  test('normaliza formatos equivalentes a la misma forma canonica', () => {
    // Los tres son el MISMO RUT escrito distinto. Si la normalizacion no los
    // unifica, la restriccion de unicidad se puede evadir cambiando el formato.
    expect(normalizarRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizarRut('12345678-5')).toBe('12345678-5');
    expect(normalizarRut('  12.345.678-5  ')).toBe('12345678-5');
  });

  test('acepta digito verificador K en minuscula y lo normaliza', () => {
    expect(normalizarRut('20.347.024-k')).toBe('20347024-K');
  });

  test('rechaza un RUT con digito verificador incorrecto', () => {
    expect(() => normalizarRut('12.345.678-9')).toThrow(DatosInvalidos);
  });

  test('rechaza un RUT con formato invalido o ausente', () => {
    expect(() => normalizarRut('no-es-un-rut')).toThrow(DatosInvalidos);
    expect(() => normalizarRut(undefined)).toThrow(DatosInvalidos);
    expect(() => normalizarRut('123-5')).toThrow(DatosInvalidos);
  });

  test('el paciente normaliza su RUT al validarse', () => {
    const paciente = new Paciente({
      rut: '12.345.678-5',
      nombres: 'Ana',
      apellidos: 'Perez',
    }).validar();
    expect(paciente.rut).toBe('12345678-5');
    expect(paciente.nombreCompleto).toBe('Ana Perez');
  });

  test('exige nombres y apellidos', () => {
    expect(() =>
      new Paciente({ rut: '12345678-5', nombres: '', apellidos: 'Perez' }).validar(),
    ).toThrow(DatosInvalidos);
    expect(() =>
      new Paciente({ rut: '12345678-5', nombres: 'Ana', apellidos: '  ' }).validar(),
    ).toThrow(DatosInvalidos);
  });
});

describe('Examen · invariantes (RF-3)', () => {
  test('exige paciente y tipo', () => {
    expect(() => new Examen({ pacienteId: null, tipo: 'Hemograma' }).validar()).toThrow(
      DatosInvalidos,
    );
    expect(() => new Examen({ pacienteId: 1, tipo: '   ' }).validar()).toThrow(DatosInvalidos);
  });

  test('rechaza un estado fuera del conjunto permitido', () => {
    expect(() => new Examen({ pacienteId: 1, tipo: 'Rx', estado: 'BORRADO' }).validar()).toThrow(
      DatosInvalidos,
    );
  });

  test('nace en estado PENDIENTE y no eliminado', () => {
    const examen = new Examen({ pacienteId: 1, tipo: 'Rx' }).validar();
    expect(examen.estado).toBe(ESTADOS_EXAMEN.PENDIENTE);
    expect(examen.estaEliminado).toBe(false);
  });

  test('estaEliminado refleja la baja logica', () => {
    const examen = new Examen({ pacienteId: 1, tipo: 'Rx', eliminadoEn: '2026-10-12T00:00:00Z' });
    expect(examen.estaEliminado).toBe(true);
  });
});

describe('CP-SEG-07 · Validacion de documentos (NFR-SEG-12)', () => {
  const base = { examenId: 1, nombreArchivo: 'informe.pdf', rutaStorage: 'x/y', tamanoBytes: 1024 };

  test('acepta un documento de tipo permitido', () => {
    expect(() => new Documento({ ...base, mime: 'application/pdf' }).validar()).not.toThrow();
  });

  test('rechaza un tipo MIME fuera de la lista blanca', () => {
    expect(() => new Documento({ ...base, mime: 'application/x-msdownload' }).validar()).toThrow(
      DatosInvalidos,
    );
    expect(() => new Documento({ ...base, mime: 'text/html' }).validar()).toThrow(DatosInvalidos);
  });

  test('rechaza un documento que excede el tamano maximo', () => {
    expect(() =>
      new Documento({
        ...base,
        mime: 'application/pdf',
        tamanoBytes: TAMANO_MAXIMO_BYTES + 1,
      }).validar(),
    ).toThrow(DatosInvalidos);
  });

  test('rechaza tamanos no validos', () => {
    expect(() =>
      new Documento({ ...base, mime: 'application/pdf', tamanoBytes: 0 }).validar(),
    ).toThrow(DatosInvalidos);
    expect(() =>
      new Documento({ ...base, mime: 'application/pdf', tamanoBytes: 1.5 }).validar(),
    ).toThrow(DatosInvalidos);
  });

  test('exige el examen asociado', () => {
    expect(() =>
      new Documento({ ...base, examenId: null, mime: 'application/pdf' }).validar(),
    ).toThrow(DatosInvalidos);
  });

  test('la firma binaria distingue un PDF real de un ejecutable renombrado', () => {
    const pdfReal = Buffer.from('%PDF-1.7 contenido');
    const ejecutable = Buffer.from('MZ\x90\x00 binario');
    expect(firmaCoincide(pdfReal, 'application/pdf')).toBe(true);
    expect(firmaCoincide(ejecutable, 'application/pdf')).toBe(false);
    expect(firmaCoincide(pdfReal, 'image/png')).toBe(false);
    expect(firmaCoincide(pdfReal, 'tipo/inexistente')).toBe(false);
  });

  test('reconoce las firmas de PNG y JPEG', () => {
    expect(firmaCoincide(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png')).toBe(true);
    expect(firmaCoincide(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
  });
});

describe('Usuario · invariantes y minimizacion (NFR-SEG-8)', () => {
  const base = {
    id: 7,
    nombreUsuario: 'medico1',
    email: 'medico1@cuidarte.test',
    passwordHash: '$2b$12$abcdefghijklmnopqrstuv',
    rol: ROLES.MEDICO,
  };

  test('aVista no expone el hash de la contrasena ni el control de bloqueo', () => {
    const vista = new Usuario({
      ...base,
      intentosFallidos: 3,
      bloqueadoHasta: new Date(),
    }).aVista();
    expect(vista).toEqual({
      id: 7,
      nombreUsuario: 'medico1',
      email: 'medico1@cuidarte.test',
      rol: ROLES.MEDICO,
      activo: true,
      creadoEn: null,
    });
    expect(vista.passwordHash).toBeUndefined();
    expect(vista.intentosFallidos).toBeUndefined();
    expect(vista.bloqueadoHasta).toBeUndefined();
  });

  test('rechaza nombre de usuario corto y rol invalido', () => {
    expect(() => new Usuario({ ...base, nombreUsuario: 'ab' }).validar()).toThrow(DatosInvalidos);
    expect(() => new Usuario({ ...base, rol: 'SUPERADMIN' }).validar()).toThrow(DatosInvalidos);
  });

  test('estaBloqueado y segundosDeBloqueoRestantes respetan el instante dado (RF-1.3)', () => {
    const ahora = new Date('2026-10-12T10:00:00Z');
    const bloqueado = new Usuario({ ...base, bloqueadoHasta: new Date('2026-10-12T10:05:00Z') });
    const libre = new Usuario({ ...base, bloqueadoHasta: new Date('2026-10-12T09:55:00Z') });

    expect(bloqueado.estaBloqueado(ahora)).toBe(true);
    expect(bloqueado.segundosDeBloqueoRestantes(ahora)).toBe(300);
    expect(libre.estaBloqueado(ahora)).toBe(false);
    expect(libre.segundosDeBloqueoRestantes(ahora)).toBe(0);
    expect(new Usuario(base).estaBloqueado(ahora)).toBe(false);
  });
});
