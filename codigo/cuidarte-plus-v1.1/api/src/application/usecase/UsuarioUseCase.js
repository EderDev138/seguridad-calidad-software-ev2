import { Usuario } from '../../domain/model/Usuario.js';
import { ROLES, ROLES_VALIDOS, ACCIONES_AUDITABLES } from '../../domain/model/roles.js';
import {
  NoEncontrado,
  Duplicado,
  DatosInvalidos,
  NoAutorizado,
  Conflicto,
} from '../../domain/error/errors.js';

/**
 * Administracion de usuarios (ERS RF-2.5, RF-2.6, RF-2.7).
 *
 * Toda operacion de este caso de uso esta reservada al rol ADMIN (RB-2). La
 * verificacion se hace aqui, en la capa de aplicacion, ademas del middleware
 * HTTP: una sola linea de defensa en el router dejaria el caso de uso
 * expuesto a cualquier otro punto de entrada (NFR-SEG-4).
 */
export class UsuarioUseCase {
  constructor({ usuarioGateway, auditoriaGateway, password }) {
    this.usuarios = usuarioGateway;
    this.auditoria = auditoriaGateway;
    this.password = password;
  }

  #exigirAdmin(actor) {
    if (!actor || actor.rol !== ROLES.ADMIN) {
      throw new NoAutorizado('Solo un administrador puede gestionar usuarios');
    }
  }

  /** RF-2.5 — el administrador lista los usuarios registrados. */
  async listar(actor) {
    this.#exigirAdmin(actor);
    const usuarios = await this.usuarios.listar();
    return usuarios.map((usuario) => usuario.aVista());
  }

  async obtener(id, actor) {
    this.#exigirAdmin(actor);
    const usuario = await this.usuarios.obtenerPorId(id);
    if (!usuario) {
      throw new NoEncontrado('Usuario', id);
    }
    return usuario.aVista();
  }

  /** El administrador crea usuarios y puede asignarles cualquier rol (RB-2). */
  async crear({ nombreUsuario, email, password, rol }, actor, contexto = {}) {
    this.#exigirAdmin(actor);
    this.password.validarPolitica(password);
    if (!ROLES_VALIDOS.includes(rol)) {
      throw new DatosInvalidos(`Rol invalido: ${rol}`, { rolesValidos: ROLES_VALIDOS });
    }
    if (await this.usuarios.obtenerPorNombreUsuario(nombreUsuario)) {
      throw new Duplicado('Usuario', 'nombre de usuario', nombreUsuario);
    }
    if (await this.usuarios.obtenerPorEmail(email)) {
      throw new Duplicado('Usuario', 'email', email);
    }

    const usuario = new Usuario({
      nombreUsuario,
      email,
      passwordHash: await this.password.hashear(password),
      rol,
    }).validar();

    const creado = await this.usuarios.crear(usuario);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.CREAR_USUARIO,
      entidad: 'usuario',
      entidadId: creado.id,
      detalle: `rol=${rol}`,
      ip: contexto.ip ?? null,
    });
    return creado.aVista();
  }

  /**
   * Aplica el cambio de rol validando que sea un rol existente y que el
   * administrador no se degrade a si mismo (lo que podria dejar al sistema sin
   * ningun administrador).
   */
  #aplicarCambioDeRol(usuario, rolNuevo, actor) {
    if (!ROLES_VALIDOS.includes(rolNuevo)) {
      throw new DatosInvalidos(`Rol invalido: ${rolNuevo}`, { rolesValidos: ROLES_VALIDOS });
    }
    if (usuario.id === actor.id && rolNuevo !== ROLES.ADMIN) {
      throw new Conflicto('Un administrador no puede cambiar su propio rol');
    }
    usuario.rol = rolNuevo;
  }

  /** Aplica el cambio de email verificando que no pertenezca a otra cuenta. */
  async #aplicarCambioDeEmail(usuario, emailNuevo) {
    const otro = await this.usuarios.obtenerPorEmail(emailNuevo);
    if (otro && otro.id !== usuario.id) {
      throw new Duplicado('Usuario', 'email', emailNuevo);
    }
    usuario.email = emailNuevo;
  }

  /** RF-2.6 — editar un usuario, incluido su rol. */
  async actualizar(id, cambios, actor, contexto = {}) {
    this.#exigirAdmin(actor);
    const usuario = await this.usuarios.obtenerPorId(id);
    if (!usuario) {
      throw new NoEncontrado('Usuario', id);
    }

    if (cambios.rol !== undefined) {
      this.#aplicarCambioDeRol(usuario, cambios.rol, actor);
    }
    if (cambios.email !== undefined) {
      await this.#aplicarCambioDeEmail(usuario, cambios.email);
    }
    if (cambios.activo !== undefined) {
      usuario.activo = Boolean(cambios.activo);
    }
    if (cambios.password !== undefined) {
      this.password.validarPolitica(cambios.password);
      usuario.passwordHash = await this.password.hashear(cambios.password);
    }

    usuario.validar();
    const actualizado = await this.usuarios.actualizar(usuario);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.EDITAR_USUARIO,
      entidad: 'usuario',
      entidadId: id,
      detalle: `campos=${Object.keys(cambios)
        .filter((campo) => campo !== 'password')
        .join(',')}`,
      ip: contexto.ip ?? null,
    });
    return actualizado.aVista();
  }

  /** RF-2.7 — eliminacion LOGICA del usuario, para conservar su trazabilidad. */
  async eliminar(id, actor, contexto = {}) {
    this.#exigirAdmin(actor);
    const usuario = await this.usuarios.obtenerPorId(id);
    if (!usuario) {
      throw new NoEncontrado('Usuario', id);
    }
    if (usuario.id === actor.id) {
      throw new Conflicto('Un administrador no puede eliminar su propia cuenta');
    }
    await this.usuarios.eliminar(id);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.ELIMINAR_USUARIO,
      entidad: 'usuario',
      entidadId: id,
      ip: contexto.ip ?? null,
    });
    return { eliminado: true };
  }
}
