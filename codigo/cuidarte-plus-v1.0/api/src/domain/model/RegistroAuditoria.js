/**
 * Entrada del registro de auditoria (ERS RF-5.1).
 *
 * El registro es append-only: el dominio no expone ninguna operacion que lo
 * actualice ni lo elimine. Esa inmutabilidad es la que le da valor probatorio
 * frente a una auditoria (ISO/IEC 27001 A.8.15, Ley 21.663).
 */
export class RegistroAuditoria {
  constructor({
    id = null,
    usuarioId = null,
    accion,
    entidad = null,
    entidadId = null,
    detalle = null,
    ip = null,
    creadoEn = null,
  }) {
    this.id = id;
    this.usuarioId = usuarioId;
    this.accion = accion;
    this.entidad = entidad;
    this.entidadId = entidadId;
    this.detalle = detalle;
    this.ip = ip;
    this.creadoEn = creadoEn;
  }
}
