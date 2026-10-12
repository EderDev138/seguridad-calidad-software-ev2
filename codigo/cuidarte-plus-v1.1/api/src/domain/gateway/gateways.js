/**
 * Puertos de salida del dominio (patron Gateway / Repository).
 *
 * Estas clases documentan el CONTRATO que la capa de infraestructura debe
 * implementar. El dominio y los casos de uso dependen unicamente de estas
 * firmas, nunca de PostgreSQL ni de Express: por eso la misma logica de
 * negocio se ejecuta contra el adaptador en memoria (pruebas unitarias y BDD)
 * o contra PostgreSQL (integracion y QA) sin cambiar una linea.
 *
 * Los metodos lanzan por defecto para que una implementacion incompleta falle
 * de inmediato y de forma visible, en lugar de devolver `undefined`.
 */
function noImplementado(metodo) {
  throw new Error(`Metodo de gateway no implementado: ${metodo}`);
}

export class UsuarioGateway {
  /** @returns {Promise<import('../model/Usuario.js').Usuario[]>} */
  async listar() {
    return noImplementado('UsuarioGateway.listar');
  }

  /** @returns {Promise<import('../model/Usuario.js').Usuario|null>} */
  async obtenerPorId(_id) {
    return noImplementado('UsuarioGateway.obtenerPorId');
  }

  /** @returns {Promise<import('../model/Usuario.js').Usuario|null>} */
  async obtenerPorNombreUsuario(_nombreUsuario) {
    return noImplementado('UsuarioGateway.obtenerPorNombreUsuario');
  }

  /** @returns {Promise<import('../model/Usuario.js').Usuario|null>} */
  async obtenerPorEmail(_email) {
    return noImplementado('UsuarioGateway.obtenerPorEmail');
  }

  async crear(_usuario) {
    return noImplementado('UsuarioGateway.crear');
  }

  async actualizar(_usuario) {
    return noImplementado('UsuarioGateway.actualizar');
  }

  /** Eliminacion logica. */
  async eliminar(_id) {
    return noImplementado('UsuarioGateway.eliminar');
  }
}

export class PacienteGateway {
  async listar() {
    return noImplementado('PacienteGateway.listar');
  }

  async obtenerPorId(_id) {
    return noImplementado('PacienteGateway.obtenerPorId');
  }

  async obtenerPorRut(_rut) {
    return noImplementado('PacienteGateway.obtenerPorRut');
  }

  async obtenerPorUsuarioId(_usuarioId) {
    return noImplementado('PacienteGateway.obtenerPorUsuarioId');
  }

  async crear(_paciente) {
    return noImplementado('PacienteGateway.crear');
  }

  async actualizar(_paciente) {
    return noImplementado('PacienteGateway.actualizar');
  }

  async eliminar(_id) {
    return noImplementado('PacienteGateway.eliminar');
  }
}

export class ExamenGateway {
  async listarPorPaciente(_pacienteId) {
    return noImplementado('ExamenGateway.listarPorPaciente');
  }

  async obtenerPorId(_id) {
    return noImplementado('ExamenGateway.obtenerPorId');
  }

  async crear(_examen) {
    return noImplementado('ExamenGateway.crear');
  }

  async actualizar(_examen) {
    return noImplementado('ExamenGateway.actualizar');
  }

  async eliminar(_id) {
    return noImplementado('ExamenGateway.eliminar');
  }
}

export class DocumentoGateway {
  async listarPorExamen(_examenId) {
    return noImplementado('DocumentoGateway.listarPorExamen');
  }

  async obtenerPorId(_id) {
    return noImplementado('DocumentoGateway.obtenerPorId');
  }

  async crear(_documento) {
    return noImplementado('DocumentoGateway.crear');
  }

  async eliminar(_id) {
    return noImplementado('DocumentoGateway.eliminar');
  }
}

export class AuditoriaGateway {
  /** Append-only: solo registra. */
  async registrar(_registro) {
    return noImplementado('AuditoriaGateway.registrar');
  }

  async listar(_filtro) {
    return noImplementado('AuditoriaGateway.listar');
  }
}

export class SesionGateway {
  /** Guarda el jti de un token revocado hasta su expiracion (RF-1.2). */
  async revocar(_jti, _expiraEn) {
    return noImplementado('SesionGateway.revocar');
  }

  /** @returns {Promise<boolean>} */
  async estaRevocado(_jti) {
    return noImplementado('SesionGateway.estaRevocado');
  }
}
