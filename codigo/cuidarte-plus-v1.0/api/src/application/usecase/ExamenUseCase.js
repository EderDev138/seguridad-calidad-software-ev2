import { Examen, ESTADOS_EXAMEN } from '../../domain/model/Examen.js';
import { ROLES, ACCIONES_AUDITABLES } from '../../domain/model/roles.js';
import { NoEncontrado, NoAutorizado, DatosInvalidos } from '../../domain/error/errors.js';

/**
 * Gestion de examenes medicos (ERS RF-3.1 a RF-3.3, RF-4.1).
 *
 * Reglas de acceso:
 *  - MEDICO: crea, edita y elimina examenes de cualquier paciente (RB-3).
 *  - ADMIN: acceso completo (RB-2).
 *  - PACIENTE: SOLO LECTURA y solo de sus propios examenes (RB-1).
 *
 * El flujo de consulta es escalonado (NFR-USAB-4): primero se accede al
 * paciente y luego a sus examenes. Por eso la lectura entra siempre por
 * `listarPorPaciente`, que delega la verificacion de titularidad en
 * `PacienteUseCase.obtener`.
 */
export class ExamenUseCase {
  constructor({ examenGateway, pacienteUseCase, auditoriaGateway }) {
    this.examenes = examenGateway;
    this.pacienteUseCase = pacienteUseCase;
    this.auditoria = auditoriaGateway;
  }

  static #puedeEscribir(actor) {
    return actor && (actor.rol === ROLES.ADMIN || actor.rol === ROLES.MEDICO);
  }

  #exigirEscritura(actor) {
    // La verificacion de permisos se resuelve en la capa de rutas.
    if (!actor) {
      throw new NoAutorizado();
    }
  }

  /** RF-4.1 — examenes de un paciente, con verificacion de titularidad. */
  async listarPorPaciente(pacienteId, actor) {
    // Si el actor no puede ver a este paciente, `obtener` ya lanza; de ese modo
    // la autorizacion del examen hereda la del paciente y no se duplica.
    await this.pacienteUseCase.obtener(pacienteId, actor);
    return this.examenes.listarPorPaciente(pacienteId);
  }

  /** Obtiene un examen validando que el actor pueda ver a su paciente. */
  async obtener(id, actor) {
    const examen = await this.examenes.obtenerPorId(id);
    if (!examen) {
      throw new NoEncontrado('Examen', id);
    }
    await this.pacienteUseCase.obtener(examen.pacienteId, actor);
    return examen;
  }

  /** RF-3.1 — un medico registra un examen para un paciente. */
  async crear(datos, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    await this.pacienteUseCase.obtener(datos.pacienteId, actor);

    const examen = new Examen({ ...datos, medicoId: actor.id }).validar();
    const creado = await this.examenes.crear(examen);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.CREAR_EXAMEN,
      entidad: 'examen',
      entidadId: creado.id,
      detalle: `pacienteId=${datos.pacienteId}`,
      ip: contexto.ip ?? null,
    });
    return creado;
  }

  /** RF-3.2 — un medico edita los datos del examen. */
  async actualizar(id, cambios, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    const examen = await this.examenes.obtenerPorId(id);
    if (!examen) {
      throw new NoEncontrado('Examen', id);
    }
    await this.pacienteUseCase.obtener(examen.pacienteId, actor);

    if (cambios.estado !== undefined && !Object.values(ESTADOS_EXAMEN).includes(cambios.estado)) {
      throw new DatosInvalidos(`Estado de examen invalido: ${cambios.estado}`, {
        estadosValidos: Object.values(ESTADOS_EXAMEN),
      });
    }

    for (const campo of ['tipo', 'descripcion', 'fechaExamen', 'estado']) {
      if (cambios[campo] !== undefined) {
        examen[campo] = cambios[campo];
      }
    }

    examen.validar();
    const actualizado = await this.examenes.actualizar(examen);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.EDITAR_EXAMEN,
      entidad: 'examen',
      entidadId: id,
      detalle: `campos=${Object.keys(cambios).join(',')}`,
      ip: contexto.ip ?? null,
    });
    return actualizado;
  }

  /**
   * RF-3.3 — eliminacion LOGICA del examen.
   *
   * El criterio de aceptacion del ERS exige baja logica previa confirmacion del
   * usuario. La confirmacion se resuelve en la interfaz; el backend garantiza
   * que la baja no destruya el registro: marca `eliminadoEn` y el examen deja
   * de aparecer entre los activos, pero sigue disponible para auditoria.
   */
  async eliminar(id, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    const examen = await this.examenes.obtenerPorId(id);
    if (!examen) {
      throw new NoEncontrado('Examen', id);
    }
    await this.pacienteUseCase.obtener(examen.pacienteId, actor);

    await this.examenes.eliminar(id);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.ELIMINAR_EXAMEN,
      entidad: 'examen',
      entidadId: id,
      detalle: 'eliminacion logica',
      ip: contexto.ip ?? null,
    });
    return { eliminado: true };
  }
}
