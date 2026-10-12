import { Usuario } from '../../../domain/model/Usuario.js';
import { Paciente } from '../../../domain/model/Paciente.js';
import { Examen } from '../../../domain/model/Examen.js';
import { Documento } from '../../../domain/model/Documento.js';
import { RegistroAuditoria } from '../../../domain/model/RegistroAuditoria.js';
import {
  UsuarioGateway,
  PacienteGateway,
  ExamenGateway,
  DocumentoGateway,
  AuditoriaGateway,
  SesionGateway,
} from '../../../domain/gateway/gateways.js';

/**
 * Implementacion en memoria de los puertos del dominio.
 *
 * Existe para que las pruebas unitarias y los escenarios BDD ejecuten la misma
 * logica de negocio sin PostgreSQL. Replica fielmente dos comportamientos del
 * adaptador real que son relevantes para las pruebas:
 *  1. La eliminacion es LOGICA (marca `eliminadoEn`).
 *  2. Las consultas de lectura excluyen los registros eliminados.
 */
class BaseMemoria {
  constructor() {
    this.items = new Map();
    this.secuencia = 0;
  }

  siguienteId() {
    this.secuencia += 1;
    return this.secuencia;
  }

  activos() {
    return [...this.items.values()].filter((item) => item.eliminadoEn === null);
  }

  activoPorId(id) {
    const item = this.items.get(Number(id));
    return item && item.eliminadoEn === null ? item : null;
  }

  marcarEliminado(id) {
    const item = this.activoPorId(id);
    if (!item) {
      return false;
    }
    item.eliminadoEn = new Date().toISOString();
    return true;
  }
}

export class UsuarioGatewayMemoria extends UsuarioGateway {
  constructor() {
    super();
    this.base = new BaseMemoria();
  }

  async listar() {
    return this.base.activos().map((item) => new Usuario(item));
  }

  async obtenerPorId(id) {
    const item = this.base.activoPorId(id);
    return item ? new Usuario(item) : null;
  }

  async obtenerPorNombreUsuario(nombreUsuario) {
    const item = this.base.activos().find((usuario) => usuario.nombreUsuario === nombreUsuario);
    return item ? new Usuario(item) : null;
  }

  async obtenerPorEmail(email) {
    const item = this.base
      .activos()
      .find((usuario) => usuario.email?.toLowerCase() === String(email).toLowerCase());
    return item ? new Usuario(item) : null;
  }

  async crear(usuario) {
    const id = this.base.siguienteId();
    const guardado = { ...usuario, id, creadoEn: new Date().toISOString(), eliminadoEn: null };
    this.base.items.set(id, guardado);
    return new Usuario(guardado);
  }

  async actualizar(usuario) {
    const existente = this.base.activoPorId(usuario.id);
    if (!existente) {
      return null;
    }
    Object.assign(existente, { ...usuario, id: existente.id, creadoEn: existente.creadoEn });
    return new Usuario(existente);
  }

  async eliminar(id) {
    return this.base.marcarEliminado(id);
  }
}

export class PacienteGatewayMemoria extends PacienteGateway {
  constructor() {
    super();
    this.base = new BaseMemoria();
  }

  async listar() {
    return this.base.activos().map((item) => new Paciente(item));
  }

  async obtenerPorId(id) {
    const item = this.base.activoPorId(id);
    return item ? new Paciente(item) : null;
  }

  async obtenerPorRut(rut) {
    const item = this.base.activos().find((paciente) => paciente.rut === rut);
    return item ? new Paciente(item) : null;
  }

  async obtenerPorUsuarioId(usuarioId) {
    const item = this.base
      .activos()
      .find((paciente) => Number(paciente.usuarioId) === Number(usuarioId));
    return item ? new Paciente(item) : null;
  }

  async crear(paciente) {
    const id = this.base.siguienteId();
    const guardado = { ...paciente, id, creadoEn: new Date().toISOString(), eliminadoEn: null };
    this.base.items.set(id, guardado);
    return new Paciente(guardado);
  }

  async actualizar(paciente) {
    const existente = this.base.activoPorId(paciente.id);
    if (!existente) {
      return null;
    }
    Object.assign(existente, { ...paciente, id: existente.id, creadoEn: existente.creadoEn });
    return new Paciente(existente);
  }

  async eliminar(id) {
    return this.base.marcarEliminado(id);
  }
}

export class ExamenGatewayMemoria extends ExamenGateway {
  constructor() {
    super();
    this.base = new BaseMemoria();
  }

  async listarPorPaciente(pacienteId) {
    return this.base
      .activos()
      .filter((examen) => Number(examen.pacienteId) === Number(pacienteId))
      .map((item) => new Examen(item));
  }

  async obtenerPorId(id) {
    const item = this.base.activoPorId(id);
    return item ? new Examen(item) : null;
  }

  async crear(examen) {
    const id = this.base.siguienteId();
    const guardado = { ...examen, id, creadoEn: new Date().toISOString(), eliminadoEn: null };
    this.base.items.set(id, guardado);
    return new Examen(guardado);
  }

  async actualizar(examen) {
    const existente = this.base.activoPorId(examen.id);
    if (!existente) {
      return null;
    }
    Object.assign(existente, { ...examen, id: existente.id, creadoEn: existente.creadoEn });
    return new Examen(existente);
  }

  async eliminar(id) {
    return this.base.marcarEliminado(id);
  }

  /** Solo para pruebas: permite comprobar que la baja fue logica y no fisica. */
  obtenerIncluyendoEliminados(id) {
    const item = this.base.items.get(Number(id));
    return item ? new Examen(item) : null;
  }
}

export class DocumentoGatewayMemoria extends DocumentoGateway {
  constructor() {
    super();
    this.base = new BaseMemoria();
  }

  async listarPorExamen(examenId) {
    return this.base
      .activos()
      .filter((documento) => Number(documento.examenId) === Number(examenId))
      .map((item) => new Documento(item));
  }

  async obtenerPorId(id) {
    const item = this.base.activoPorId(id);
    return item ? new Documento(item) : null;
  }

  async crear(documento) {
    const id = this.base.siguienteId();
    const guardado = { ...documento, id, creadoEn: new Date().toISOString(), eliminadoEn: null };
    this.base.items.set(id, guardado);
    return new Documento(guardado);
  }

  async eliminar(id) {
    return this.base.marcarEliminado(id);
  }
}

export class AuditoriaGatewayMemoria extends AuditoriaGateway {
  constructor() {
    super();
    this.registros = [];
  }

  async registrar(datos) {
    const registro = new RegistroAuditoria({
      ...datos,
      id: this.registros.length + 1,
      creadoEn: new Date().toISOString(),
    });
    this.registros.push(registro);
    return registro;
  }

  async listar(filtro = {}) {
    let resultado = [...this.registros].reverse();
    if (filtro.accion) {
      resultado = resultado.filter((registro) => registro.accion === filtro.accion);
    }
    if (filtro.usuarioId) {
      resultado = resultado.filter(
        (registro) => Number(registro.usuarioId) === Number(filtro.usuarioId),
      );
    }
    return resultado.slice(0, filtro.limite ?? 100);
  }
}

export class SesionGatewayMemoria extends SesionGateway {
  constructor() {
    super();
    this.revocados = new Map();
  }

  async revocar(jti, expiraEn) {
    this.revocados.set(jti, expiraEn ?? null);
    return true;
  }

  async estaRevocado(jti) {
    return this.revocados.has(jti);
  }
}

/** Arma un juego completo de gateways en memoria. */
export function crearGatewaysEnMemoria() {
  return {
    usuarioGateway: new UsuarioGatewayMemoria(),
    pacienteGateway: new PacienteGatewayMemoria(),
    examenGateway: new ExamenGatewayMemoria(),
    documentoGateway: new DocumentoGatewayMemoria(),
    auditoriaGateway: new AuditoriaGatewayMemoria(),
    sesionGateway: new SesionGatewayMemoria(),
  };
}
