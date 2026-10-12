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
import { Duplicado } from '../../../domain/error/errors.js';

/**
 * Adaptadores de persistencia sobre PostgreSQL.
 *
 * Regla sin excepciones en este archivo: **toda** consulta usa parametros
 * posicionales (`$1`, `$2`, ...). Nunca se concatena ni se interpola un valor
 * de entrada dentro del SQL. La concatenacion es el origen del incidente
 * INC-02 (inyeccion SQL) detectado en la version 1.0 (NFR-SEG-5, OWASP A03).
 *
 * La segunda regla es que los mapeos viven aqui: el dominio usa camelCase y la
 * base de datos snake_case, y esa traduccion no debe filtrarse al nucleo.
 */

/** Codigo de PostgreSQL para violacion de restriccion unica. */
const PG_UNIQUE_VIOLATION = '23505';

function filaAUsuario(fila) {
  if (!fila) {
    return null;
  }
  return new Usuario({
    id: Number(fila.id),
    nombreUsuario: fila.nombre_usuario,
    email: fila.email,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    activo: fila.activo,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta,
    creadoEn: fila.creado_en,
    eliminadoEn: fila.eliminado_en,
  });
}

function filaAPaciente(fila) {
  if (!fila) {
    return null;
  }
  return new Paciente({
    id: Number(fila.id),
    rut: fila.rut,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento,
    telefono: fila.telefono,
    email: fila.email,
    usuarioId: fila.usuario_id === null ? null : Number(fila.usuario_id),
    creadoEn: fila.creado_en,
    eliminadoEn: fila.eliminado_en,
  });
}

function filaAExamen(fila) {
  if (!fila) {
    return null;
  }
  return new Examen({
    id: Number(fila.id),
    pacienteId: Number(fila.paciente_id),
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    fechaExamen: fila.fecha_examen,
    medicoId: fila.medico_id === null ? null : Number(fila.medico_id),
    estado: fila.estado,
    creadoEn: fila.creado_en,
    eliminadoEn: fila.eliminado_en,
  });
}

function filaADocumento(fila) {
  if (!fila) {
    return null;
  }
  return new Documento({
    id: Number(fila.id),
    examenId: Number(fila.examen_id),
    nombreArchivo: fila.nombre_archivo,
    mime: fila.mime,
    tamanoBytes: Number(fila.tamano_bytes),
    rutaStorage: fila.ruta_storage,
    subidoPor: fila.subido_por === null ? null : Number(fila.subido_por),
    creadoEn: fila.creado_en,
    eliminadoEn: fila.eliminado_en,
  });
}

/**
 * Traduce una violacion de unicidad de PostgreSQL al error de dominio
 * correspondiente, para que la capa REST devuelva 409 y no un 500 opaco.
 * Devolver 500 ante un duplicado es parte del incidente INC-01.
 */
function traducirError(error, entidad) {
  if (error?.code === PG_UNIQUE_VIOLATION) {
    const campo = error.constraint?.includes('rut')
      ? 'RUT'
      : error.constraint?.includes('email')
        ? 'email'
        : 'identificador';
    return new Duplicado(entidad, campo, 'valor ya registrado');
  }
  return error;
}

export class UsuarioGatewayPg extends UsuarioGateway {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listar() {
    const { rows } = await this.pool.query(
      `SELECT * FROM usuario WHERE eliminado_en IS NULL ORDER BY id`,
    );
    return rows.map(filaAUsuario);
  }

  async obtenerPorId(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM usuario WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return filaAUsuario(rows[0]);
  }

  async obtenerPorNombreUsuario(nombreUsuario) {
    const { rows } = await this.pool.query(
      `SELECT * FROM usuario WHERE lower(nombre_usuario) = lower($1) AND eliminado_en IS NULL`,
      [nombreUsuario],
    );
    return filaAUsuario(rows[0]);
  }

  async obtenerPorEmail(email) {
    const { rows } = await this.pool.query(
      `SELECT * FROM usuario WHERE lower(email) = lower($1) AND eliminado_en IS NULL`,
      [email],
    );
    return filaAUsuario(rows[0]);
  }

  async crear(usuario) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO usuario (nombre_usuario, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [usuario.nombreUsuario, usuario.email, usuario.passwordHash, usuario.rol, usuario.activo],
      );
      return filaAUsuario(rows[0]);
    } catch (error) {
      throw traducirError(error, 'Usuario');
    }
  }

  async actualizar(usuario) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE usuario
            SET email = $2,
                password_hash = $3,
                rol = $4,
                activo = $5,
                intentos_fallidos = $6,
                bloqueado_hasta = $7
          WHERE id = $1 AND eliminado_en IS NULL
          RETURNING *`,
        [
          usuario.id,
          usuario.email,
          usuario.passwordHash,
          usuario.rol,
          usuario.activo,
          usuario.intentosFallidos,
          usuario.bloqueadoHasta,
        ],
      );
      return filaAUsuario(rows[0]);
    } catch (error) {
      throw traducirError(error, 'Usuario');
    }
  }

  async eliminar(id) {
    const { rowCount } = await this.pool.query(
      `UPDATE usuario SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return rowCount > 0;
  }
}

export class PacienteGatewayPg extends PacienteGateway {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listar() {
    const { rows } = await this.pool.query(
      `SELECT * FROM paciente WHERE eliminado_en IS NULL ORDER BY apellidos, nombres`,
    );
    return rows.map(filaAPaciente);
  }

  async obtenerPorId(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM paciente WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return filaAPaciente(rows[0]);
  }

  async obtenerPorRut(rut) {
    const { rows } = await this.pool.query(
      `SELECT * FROM paciente WHERE rut = $1 AND eliminado_en IS NULL`,
      [rut],
    );
    return filaAPaciente(rows[0]);
  }

  async obtenerPorUsuarioId(usuarioId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM paciente WHERE usuario_id = $1 AND eliminado_en IS NULL`,
      [usuarioId],
    );
    return filaAPaciente(rows[0]);
  }

  async crear(paciente) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO paciente (rut, nombres, apellidos, fecha_nacimiento, telefono, email, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          paciente.rut,
          paciente.nombres,
          paciente.apellidos,
          paciente.fechaNacimiento,
          paciente.telefono,
          paciente.email,
          paciente.usuarioId,
        ],
      );
      return filaAPaciente(rows[0]);
    } catch (error) {
      throw traducirError(error, 'Paciente');
    }
  }

  async actualizar(paciente) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE paciente
            SET rut = $2,
                nombres = $3,
                apellidos = $4,
                fecha_nacimiento = $5,
                telefono = $6,
                email = $7,
                usuario_id = $8
          WHERE id = $1 AND eliminado_en IS NULL
          RETURNING *`,
        [
          paciente.id,
          paciente.rut,
          paciente.nombres,
          paciente.apellidos,
          paciente.fechaNacimiento,
          paciente.telefono,
          paciente.email,
          paciente.usuarioId,
        ],
      );
      return filaAPaciente(rows[0]);
    } catch (error) {
      throw traducirError(error, 'Paciente');
    }
  }

  async eliminar(id) {
    const { rowCount } = await this.pool.query(
      `UPDATE paciente SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return rowCount > 0;
  }
}

export class ExamenGatewayPg extends ExamenGateway {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listarPorPaciente(pacienteId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM examen
        WHERE paciente_id = $1 AND eliminado_en IS NULL
        ORDER BY fecha_examen DESC NULLS LAST, id DESC`,
      [pacienteId],
    );
    return rows.map(filaAExamen);
  }

  async obtenerPorId(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM examen WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return filaAExamen(rows[0]);
  }

  async crear(examen) {
    const { rows } = await this.pool.query(
      `INSERT INTO examen (paciente_id, tipo, descripcion, fecha_examen, medico_id, estado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        examen.pacienteId,
        examen.tipo,
        examen.descripcion,
        examen.fechaExamen,
        examen.medicoId,
        examen.estado,
      ],
    );
    return filaAExamen(rows[0]);
  }

  async actualizar(examen) {
    const { rows } = await this.pool.query(
      `UPDATE examen
          SET tipo = $2, descripcion = $3, fecha_examen = $4, estado = $5
        WHERE id = $1 AND eliminado_en IS NULL
        RETURNING *`,
      [examen.id, examen.tipo, examen.descripcion, examen.fechaExamen, examen.estado],
    );
    return filaAExamen(rows[0]);
  }

  /** Baja LOGICA: el registro permanece para auditoria (RF-3.3). */
  async eliminar(id) {
    const { rowCount } = await this.pool.query(
      `UPDATE examen SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return rowCount > 0;
  }
}

export class DocumentoGatewayPg extends DocumentoGateway {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listarPorExamen(examenId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM documento WHERE examen_id = $1 AND eliminado_en IS NULL ORDER BY id`,
      [examenId],
    );
    return rows.map(filaADocumento);
  }

  async obtenerPorId(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM documento WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return filaADocumento(rows[0]);
  }

  async crear(documento) {
    const { rows } = await this.pool.query(
      `INSERT INTO documento (examen_id, nombre_archivo, mime, tamano_bytes, ruta_storage, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        documento.examenId,
        documento.nombreArchivo,
        documento.mime,
        documento.tamanoBytes,
        documento.rutaStorage,
        documento.subidoPor,
      ],
    );
    return filaADocumento(rows[0]);
  }

  async eliminar(id) {
    const { rowCount } = await this.pool.query(
      `UPDATE documento SET eliminado_en = now() WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );
    return rowCount > 0;
  }
}

export class AuditoriaGatewayPg extends AuditoriaGateway {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async registrar(datos) {
    const { rows } = await this.pool.query(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        datos.usuarioId ?? null,
        datos.accion,
        datos.entidad ?? null,
        datos.entidadId ?? null,
        datos.detalle ?? null,
        datos.ip ?? null,
      ],
    );
    const fila = rows[0];
    return new RegistroAuditoria({
      id: Number(fila.id),
      usuarioId: fila.usuario_id === null ? null : Number(fila.usuario_id),
      accion: fila.accion,
      entidad: fila.entidad,
      entidadId: fila.entidad_id === null ? null : Number(fila.entidad_id),
      detalle: fila.detalle,
      ip: fila.ip,
      creadoEn: fila.creado_en,
    });
  }

  /**
   * Filtros opcionales aplicados con parametros posicionales.
   *
   * El arreglo `condiciones` se construye en el servidor con texto fijo; lo
   * unico que proviene del cliente son los VALORES, que viajan en `valores` y
   * nunca se interpolan en la consulta.
   */
  async listar(filtro = {}) {
    const condiciones = [];
    const valores = [];

    if (filtro.accion) {
      valores.push(filtro.accion);
      condiciones.push(`accion = $${valores.length}`);
    }
    if (filtro.usuarioId) {
      valores.push(filtro.usuarioId);
      condiciones.push(`usuario_id = $${valores.length}`);
    }
    if (filtro.entidad) {
      valores.push(filtro.entidad);
      condiciones.push(`entidad = $${valores.length}`);
    }

    valores.push(Math.min(Number(filtro.limite ?? 100), 5000));
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT * FROM auditoria ${where} ORDER BY creado_en DESC LIMIT $${valores.length}`,
      valores,
    );
    return rows.map(
      (fila) =>
        new RegistroAuditoria({
          id: Number(fila.id),
          usuarioId: fila.usuario_id === null ? null : Number(fila.usuario_id),
          accion: fila.accion,
          entidad: fila.entidad,
          entidadId: fila.entidad_id === null ? null : Number(fila.entidad_id),
          detalle: fila.detalle,
          ip: fila.ip,
          creadoEn: fila.creado_en,
        }),
    );
  }
}

/**
 * Lista de revocacion de tokens (RF-1.2).
 *
 * Implementacion en memoria del proceso: suficiente para una instancia unica
 * de QA. En produccion con varias instancias debe respaldarse en Redis o en
 * una tabla compartida; la limitacion queda documentada en el informe.
 */
export class SesionGatewayPg extends SesionGateway {
  constructor() {
    super();
    this.revocados = new Map();
  }

  async revocar(jti, expiraEn) {
    this.revocados.set(jti, expiraEn ?? null);
    this.#purgar();
    return true;
  }

  async estaRevocado(jti) {
    this.#purgar();
    return this.revocados.has(jti);
  }

  /** Elimina las entradas cuyos tokens ya expiraron por si mismos. */
  #purgar() {
    const ahora = Math.floor(Date.now() / 1000);
    for (const [jti, expiraEn] of this.revocados.entries()) {
      if (typeof expiraEn === 'number' && expiraEn < ahora) {
        this.revocados.delete(jti);
      }
    }
  }
}
