import { DatosInvalidos } from '../error/errors.js';

export const ESTADOS_EXAMEN = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  COMPLETADO: 'COMPLETADO',
});

/**
 * Examen medico asociado a un paciente (ERS RF-3.1 a RF-3.3).
 *
 * La eliminacion es LOGICA: `eliminadoEn` marca la baja y el registro
 * permanece en la base de datos para efectos de trazabilidad y auditoria,
 * tal como exige el criterio de aceptacion de RF-3.3.
 */
export class Examen {
  constructor({
    id = null,
    pacienteId,
    tipo,
    descripcion = null,
    fechaExamen = null,
    medicoId = null,
    estado = ESTADOS_EXAMEN.PENDIENTE,
    creadoEn = null,
    eliminadoEn = null,
  }) {
    this.id = id;
    this.pacienteId = pacienteId;
    this.tipo = tipo;
    this.descripcion = descripcion;
    this.fechaExamen = fechaExamen;
    this.medicoId = medicoId;
    this.estado = estado;
    this.creadoEn = creadoEn;
    this.eliminadoEn = eliminadoEn;
  }

  validar() {
    if (!this.pacienteId) {
      throw new DatosInvalidos('El examen debe estar asociado a un paciente');
    }
    if (!this.tipo || !this.tipo.trim()) {
      throw new DatosInvalidos('El tipo de examen es obligatorio');
    }
    if (!Object.values(ESTADOS_EXAMEN).includes(this.estado)) {
      throw new DatosInvalidos(`Estado de examen invalido: ${this.estado}`);
    }
    return this;
  }

  get estaEliminado() {
    return this.eliminadoEn !== null;
  }
}
