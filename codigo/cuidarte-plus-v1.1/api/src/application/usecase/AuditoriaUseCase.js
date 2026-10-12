import { ROLES } from '../../domain/model/roles.js';
import { NoAutorizado } from '../../domain/error/errors.js';

/**
 * Consulta del registro de auditoria (ERS RF-5.1 y RF-5.2 propuesto).
 *
 * El registro es la evidencia de trazabilidad del sistema, por lo que su
 * lectura queda restringida al rol ADMIN: para el resto de los roles seria un
 * mapa de quien accedio a que dato clinico y cuando.
 */
export class AuditoriaUseCase {
  constructor({ auditoriaGateway }) {
    this.auditoria = auditoriaGateway;
  }

  #exigirAdmin(actor) {
    if (!actor || actor.rol !== ROLES.ADMIN) {
      throw new NoAutorizado('Solo un administrador puede consultar la auditoria');
    }
  }

  /**
   * Lista los registros aplicando filtros opcionales y un limite acotado.
   * El limite evita que una sola consulta exporte el registro completo.
   */
  async listar(filtro, actor) {
    this.#exigirAdmin(actor);
    const limite = Math.min(Number(filtro?.limite ?? 100), 500);
    return this.auditoria.listar({ ...filtro, limite });
  }

  /**
   * RF-5.2 (propuesto) — exportacion del registro para una auditoria externa.
   * La exportacion es en si misma una accion auditable.
   */
  async exportar(filtro, actor) {
    this.#exigirAdmin(actor);
    const registros = await this.auditoria.listar({ ...filtro, limite: 5000 });
    return {
      generadoEn: new Date().toISOString(),
      generadoPor: actor.id,
      total: registros.length,
      registros,
    };
  }
}
