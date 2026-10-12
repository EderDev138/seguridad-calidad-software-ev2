/**
 * Errores de negocio del dominio.
 *
 * El dominio no conoce HTTP: cada error expone un `codigo` estable que la capa
 * REST traduce a un status (ver `middleware/errorHandler.js`). Asi el nucleo
 * queda libre de framework y los codigos quedan trazables al ERS.
 */
export class ErrorDominio extends Error {
  constructor(mensaje, codigo, detalle = undefined) {
    super(mensaje);
    this.name = new.target.name;
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

/** La entidad solicitada no existe o fue eliminada logicamente. */
export class NoEncontrado extends ErrorDominio {
  constructor(entidad, id) {
    super(`${entidad} no encontrado: ${id}`, 'NO_ENCONTRADO');
    this.entidad = entidad;
  }
}

/** Violacion de una restriccion de unicidad (por ejemplo, RUT de paciente). */
export class Duplicado extends ErrorDominio {
  constructor(entidad, campo, valor) {
    super(`${entidad} ya existe con ${campo}: ${valor}`, 'DUPLICADO');
    this.entidad = entidad;
    this.campo = campo;
  }
}

/** Datos de entrada que no cumplen una regla de negocio o de formato. */
export class DatosInvalidos extends ErrorDominio {
  constructor(mensaje, detalle = undefined) {
    super(mensaje, 'DATOS_INVALIDOS', detalle);
  }
}

/** Credenciales incorrectas o sesion no valida (RF-1.1, NFR-SEG-9). */
export class NoAutenticado extends ErrorDominio {
  constructor(mensaje = 'Credenciales invalidas') {
    super(mensaje, 'NO_AUTENTICADO');
  }
}

/** El rol del usuario no permite la operacion (NFR-SEG-4, RB-1/RB-2/RB-3). */
export class NoAutorizado extends ErrorDominio {
  constructor(mensaje = 'No tiene permisos para realizar esta operacion') {
    super(mensaje, 'NO_AUTORIZADO');
  }
}

/** La operacion contradice el estado actual de la entidad. */
export class Conflicto extends ErrorDominio {
  constructor(mensaje) {
    super(mensaje, 'CONFLICTO');
  }
}

/** Demasiados intentos de autenticacion (RF-1.3, NFR-SEG-11). */
export class DemasiadosIntentos extends ErrorDominio {
  constructor(segundosRestantes) {
    super(
      `Cuenta bloqueada temporalmente por intentos fallidos. Reintente en ${segundosRestantes} s`,
      'DEMASIADOS_INTENTOS',
    );
    this.segundosRestantes = segundosRestantes;
  }
}
