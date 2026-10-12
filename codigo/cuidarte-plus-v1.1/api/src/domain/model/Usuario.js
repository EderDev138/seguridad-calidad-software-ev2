import { ROLES_VALIDOS } from './roles.js';
import { DatosInvalidos } from '../error/errors.js';

/**
 * Usuario del sistema (ERS RF-1, RF-2).
 *
 * El hash de la contrasena vive en el modelo pero NUNCA se serializa hacia el
 * cliente: `aVista()` es la unica representacion que sale por la API y aplica
 * el principio de minimizacion de datos (Ley 19.628 / 21.719, NFR-SEG-8).
 */
export class Usuario {
  constructor({
    id = null,
    nombreUsuario,
    email,
    passwordHash,
    rol,
    activo = true,
    intentosFallidos = 0,
    bloqueadoHasta = null,
    creadoEn = null,
    eliminadoEn = null,
  }) {
    this.id = id;
    this.nombreUsuario = nombreUsuario;
    this.email = email;
    this.passwordHash = passwordHash;
    this.rol = rol;
    this.activo = activo;
    this.intentosFallidos = intentosFallidos;
    this.bloqueadoHasta = bloqueadoHasta;
    this.creadoEn = creadoEn;
    this.eliminadoEn = eliminadoEn;
  }

  /** Valida las invariantes del modelo antes de persistir. */
  validar() {
    if (!this.nombreUsuario || this.nombreUsuario.trim().length < 3) {
      throw new DatosInvalidos('El nombre de usuario debe tener al menos 3 caracteres');
    }
    if (!ROLES_VALIDOS.includes(this.rol)) {
      throw new DatosInvalidos(`Rol invalido: ${this.rol}`);
    }
    return this;
  }

  /** @returns {boolean} true si la cuenta esta bloqueada en este instante (RF-1.3). */
  estaBloqueado(ahora = new Date()) {
    return this.bloqueadoHasta !== null && new Date(this.bloqueadoHasta) > ahora;
  }

  /** Segundos que faltan para que expire el bloqueo temporal. */
  segundosDeBloqueoRestantes(ahora = new Date()) {
    if (!this.estaBloqueado(ahora)) {
      return 0;
    }
    return Math.ceil((new Date(this.bloqueadoHasta).getTime() - ahora.getTime()) / 1000);
  }

  /** Proyeccion segura del usuario: sin hash de contrasena ni control interno. */
  aVista() {
    return {
      id: this.id,
      nombreUsuario: this.nombreUsuario,
      email: this.email,
      rol: this.rol,
      activo: this.activo,
      creadoEn: this.creadoEn,
    };
  }
}
