import { DatosInvalidos } from '../error/errors.js';

/** Modulo 11 del RUT chileno: calcula el digito verificador esperado. */
function digitoVerificador(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) {
    return '0';
  }
  if (resto === 10) {
    return 'K';
  }
  return String(resto);
}

/**
 * Normaliza un RUT a su forma canonica `12345678-9`: sin puntos, con guion y
 * con el digito verificador en mayuscula.
 *
 * La forma canonica es la que se persiste. Guardar el RUT normalizado es lo
 * que impide evadir la restriccion de unicidad cambiando el formato de
 * entrada ("12.345.678-9" vs "12345678-9"), que es el origen del incidente
 * INC-01 detectado en la version 1.0.
 */
export function normalizarRut(rut) {
  if (typeof rut !== 'string') {
    throw new DatosInvalidos('El RUT es obligatorio');
  }
  const limpio = rut.replace(/[.\s]/g, '').toUpperCase();
  const match = /^(\d{7,8})-?([\dK])$/.exec(limpio);
  if (!match) {
    throw new DatosInvalidos(`Formato de RUT invalido: ${rut}`);
  }
  const [, cuerpo, dv] = match;
  if (digitoVerificador(cuerpo) !== dv) {
    throw new DatosInvalidos(`El digito verificador del RUT ${rut} no es valido`);
  }
  return `${cuerpo}-${dv}`;
}

/**
 * Paciente (ERS RF-2.2 a RF-2.4).
 *
 * `usuarioId` vincula opcionalmente la ficha clinica con una cuenta de rol
 * PACIENTE. Ese vinculo es el que permite al backend distinguir si un paciente
 * consulta su propia informacion o la de un tercero (RB-1, OWASP A01).
 */
export class Paciente {
  constructor({
    id = null,
    rut,
    nombres,
    apellidos,
    fechaNacimiento = null,
    telefono = null,
    email = null,
    usuarioId = null,
    creadoEn = null,
    eliminadoEn = null,
  }) {
    this.id = id;
    this.rut = rut;
    this.nombres = nombres;
    this.apellidos = apellidos;
    this.fechaNacimiento = fechaNacimiento;
    this.telefono = telefono;
    this.email = email;
    this.usuarioId = usuarioId;
    this.creadoEn = creadoEn;
    this.eliminadoEn = eliminadoEn;
  }

  validar() {
    this.rut = normalizarRut(this.rut);
    if (!this.nombres || !this.nombres.trim()) {
      throw new DatosInvalidos('Los nombres del paciente son obligatorios');
    }
    if (!this.apellidos || !this.apellidos.trim()) {
      throw new DatosInvalidos('Los apellidos del paciente son obligatorios');
    }
    return this;
  }

  get nombreCompleto() {
    return `${this.nombres} ${this.apellidos}`.trim();
  }
}
