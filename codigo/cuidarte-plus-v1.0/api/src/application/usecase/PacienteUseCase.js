import { Paciente, normalizarRut } from '../../domain/model/Paciente.js';
import { ROLES, ACCIONES_AUDITABLES } from '../../domain/model/roles.js';
import { NoEncontrado, Duplicado, NoAutorizado } from '../../domain/error/errors.js';

/**
 * Gestion de pacientes (ERS RF-2.2, RF-2.3, RF-2.4).
 *
 * Reglas de acceso aplicadas (RB-1, RB-2, RB-3):
 *  - ADMIN y MEDICO: lectura y escritura sobre cualquier paciente.
 *  - PACIENTE: lectura unicamente de SU PROPIA ficha. El filtro no es "soy
 *    paciente, puedo leer", sino "soy paciente y esta ficha esta vinculada a
 *    mi cuenta"; de lo contrario cualquier paciente podria leer la ficha de
 *    otro cambiando el id de la URL (IDOR, OWASP A01).
 */
export class PacienteUseCase {
  constructor({ pacienteGateway, auditoriaGateway }) {
    this.pacientes = pacienteGateway;
    this.auditoria = auditoriaGateway;
  }

  static #puedeEscribir(actor) {
    return actor && (actor.rol === ROLES.ADMIN || actor.rol === ROLES.MEDICO);
  }

  #exigirEscritura(actor) {
    if (!PacienteUseCase.#puedeEscribir(actor)) {
      throw new NoAutorizado('Solo un medico o un administrador puede modificar pacientes');
    }
  }

  /**
   * RF-2.4 / RF-4.1 — listado de pacientes.
   *
   * Un paciente autenticado recibe unicamente su propia ficha, no el listado
   * completo del centro de salud (minimizacion, Ley 19.628 / 21.719).
   */
  async listar(actor) {
    if (PacienteUseCase.#puedeEscribir(actor)) {
      return this.pacientes.listar();
    }
    if (actor?.rol === ROLES.PACIENTE) {
      const propio = await this.pacientes.obtenerPorUsuarioId(actor.id);
      return propio ? [propio] : [];
    }
    throw new NoAutorizado();
  }

  /**
   * Obtiene una ficha verificando la titularidad cuando el actor es paciente.
   * Devuelve 404 y no 403 ante una ficha ajena, para no confirmar su
   * existencia a quien no deberia conocerla.
   */
  async obtener(id, actor) {
    const paciente = await this.pacientes.obtenerPorId(id);
    if (!paciente) {
      throw new NoEncontrado('Paciente', id);
    }
    if (!PacienteUseCase.#puedeEscribir(actor)) {
      if (actor?.rol !== ROLES.PACIENTE || paciente.usuarioId !== actor.id) {
        throw new NoEncontrado('Paciente', id);
      }
    }
    return paciente;
  }

  /** RF-2.2 — un medico o administrador registra un paciente. */
  async crear(datos, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    const paciente = new Paciente(datos).validar();

    // El RUT ya viene normalizado por `validar()`, de modo que la busqueda de
    // duplicados no se puede evadir cambiando el formato de entrada (INC-01).
    if (await this.pacientes.obtenerPorRut(paciente.rut)) {
      throw new Duplicado('Paciente', 'RUT', paciente.rut);
    }

    const creado = await this.pacientes.crear(paciente);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.CREAR_PACIENTE,
      entidad: 'paciente',
      entidadId: creado.id,
      ip: contexto.ip ?? null,
    });
    return creado;
  }

  /** RF-2.3 — un medico o administrador actualiza la ficha del paciente. */
  async actualizar(id, cambios, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    const paciente = await this.pacientes.obtenerPorId(id);
    if (!paciente) {
      throw new NoEncontrado('Paciente', id);
    }

    if (cambios.rut !== undefined) {
      const rutNormalizado = normalizarRut(cambios.rut);
      const otro = await this.pacientes.obtenerPorRut(rutNormalizado);
      if (otro && otro.id !== paciente.id) {
        throw new Duplicado('Paciente', 'RUT', rutNormalizado);
      }
      paciente.rut = rutNormalizado;
    }

    for (const campo of [
      'nombres',
      'apellidos',
      'fechaNacimiento',
      'telefono',
      'email',
      'usuarioId',
    ]) {
      if (cambios[campo] !== undefined) {
        paciente[campo] = cambios[campo];
      }
    }

    paciente.validar();
    const actualizado = await this.pacientes.actualizar(paciente);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.EDITAR_PACIENTE,
      entidad: 'paciente',
      entidadId: id,
      detalle: `campos=${Object.keys(cambios).join(',')}`,
      ip: contexto.ip ?? null,
    });
    return actualizado;
  }

  /** Eliminacion logica de la ficha del paciente. */
  async eliminar(id, actor, contexto = {}) {
    this.#exigirEscritura(actor);
    const paciente = await this.pacientes.obtenerPorId(id);
    if (!paciente) {
      throw new NoEncontrado('Paciente', id);
    }
    await this.pacientes.eliminar(id);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.ELIMINAR_PACIENTE,
      entidad: 'paciente',
      entidadId: id,
      ip: contexto.ip ?? null,
    });
    return { eliminado: true };
  }
}
