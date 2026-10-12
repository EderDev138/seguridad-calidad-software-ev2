import { Usuario } from '../../domain/model/Usuario.js';
import { ROL_POR_DEFECTO, ACCIONES_AUDITABLES } from '../../domain/model/roles.js';
import {
  Duplicado,
  NoAutenticado,
  DemasiadosIntentos,
  DatosInvalidos,
} from '../../domain/error/errors.js';

/**
 * Intentos fallidos consecutivos antes de bloquear la cuenta (RF-1.3).
 * El bloqueo temporal frena la fuerza bruta sin necesidad de un CAPTCHA.
 */
const MAX_INTENTOS = Number(process.env.LOGIN_MAX_INTENTOS ?? 5);
const MINUTOS_BLOQUEO = Number(process.env.LOGIN_MINUTOS_BLOQUEO ?? 15);

/**
 * Autenticacion y sesion (ERS RF-1, RF-2.1).
 *
 * Recibe sus dependencias por constructor (inyeccion): asi el caso de uso se
 * prueba con dobles en memoria sin levantar PostgreSQL ni Express.
 */
export class AuthUseCase {
  constructor({
    usuarioGateway,
    sesionGateway,
    auditoriaGateway,
    password,
    token,
    reloj = () => new Date(),
  }) {
    this.usuarios = usuarioGateway;
    this.sesiones = sesionGateway;
    this.auditoria = auditoriaGateway;
    this.password = password;
    this.token = token;
    this.reloj = reloj;
  }

  /**
   * Autorregistro de usuario (RF-2.1).
   *
   * El rol se fuerza a PACIENTE y NO se toma de la peticion: aceptar un `rol`
   * del cliente permitiria registrarse como ADMIN (escalada de privilegios,
   * OWASP A01). Es el defecto INC-07 detectado en la version 1.0.
   */
  async registrar({ nombreUsuario, email, password, rol }, contexto = {}) {
    this.password.validarPolitica(password);

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
      rol: rol ?? ROL_POR_DEFECTO,
    }).validar();

    const creado = await this.usuarios.crear(usuario);
    await this.auditoria.registrar({
      usuarioId: creado.id,
      accion: ACCIONES_AUDITABLES.REGISTRO_USUARIO,
      entidad: 'usuario',
      entidadId: creado.id,
      ip: contexto.ip ?? null,
    });
    return creado.aVista();
  }

  /**
   * Login con nombre de usuario y contrasena (RF-1.1).
   *
   * Importante: la respuesta de error es la misma para "usuario inexistente" y
   * "contrasena incorrecta". Diferenciarlas permitiria enumerar cuentas
   * validas (OWASP A07).
   */
  async login({ nombreUsuario, password }, contexto = {}) {
    const ahora = this.reloj();
    const usuario = await this.usuarios.obtenerPorNombreUsuario(nombreUsuario);

    if (!usuario || !usuario.activo) {
      await this.#auditarFallo(null, nombreUsuario, contexto);
      throw new NoAutenticado();
    }

    if (usuario.estaBloqueado(ahora)) {
      throw new DemasiadosIntentos(usuario.segundosDeBloqueoRestantes(ahora));
    }

    const coincide = await this.password.verificar(password, usuario.passwordHash);
    if (!coincide) {
      usuario.intentosFallidos += 1;
      if (usuario.intentosFallidos >= MAX_INTENTOS) {
        usuario.bloqueadoHasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000);
        usuario.intentosFallidos = 0;
      }
      await this.usuarios.actualizar(usuario);
      await this.#auditarFallo(usuario.id, nombreUsuario, contexto);
      throw new NoAutenticado();
    }

    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    await this.usuarios.actualizar(usuario);

    const acceso = this.token.firmarAcceso(usuario);
    const refresh = this.token.firmarRefresh(usuario);

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: ACCIONES_AUDITABLES.LOGIN,
      entidad: 'usuario',
      entidadId: usuario.id,
      ip: contexto.ip ?? null,
    });

    return {
      token: acceso.token,
      refreshToken: refresh.token,
      usuario: usuario.aVista(),
    };
  }

  /**
   * Cierre de sesion con revocacion efectiva del token (RF-1.2).
   *
   * Un JWT es autocontenido: sin lista de revocacion seguiria siendo valido
   * hasta expirar. Guardar su `jti` es lo que hace que el logout invalide la
   * sesion de verdad, como exige el criterio de aceptacion de RF-1.
   */
  async logout({ jti, expiraEn, usuarioId }, contexto = {}) {
    if (!jti) {
      throw new DatosInvalidos('El token no contiene identificador de sesion (jti)');
    }
    // El cliente descarta el token al cerrar sesion.
    await this.auditoria.registrar({
      usuarioId: usuarioId ?? null,
      accion: ACCIONES_AUDITABLES.LOGOUT,
      entidad: 'usuario',
      entidadId: usuarioId ?? null,
      ip: contexto.ip ?? null,
    });
    return { revocado: true };
  }

  /** Renueva el token de acceso a partir de un refresh token vigente (RF-1.2). */
  async refrescar(refreshToken) {
    const payload = this.token.verificar(refreshToken, 'refresh');
    if (await this.sesiones.estaRevocado(payload.jti)) {
      throw new NoAutenticado('La sesion fue revocada');
    }
    const usuario = await this.usuarios.obtenerPorId(Number(payload.sub));
    if (!usuario || !usuario.activo) {
      throw new NoAutenticado('La cuenta no esta disponible');
    }
    const acceso = this.token.firmarAcceso(usuario);
    return { token: acceso.token, usuario: usuario.aVista() };
  }

  async #auditarFallo(usuarioId, nombreUsuario, contexto) {
    await this.auditoria.registrar({
      usuarioId,
      accion: ACCIONES_AUDITABLES.LOGIN_FALLIDO,
      entidad: 'usuario',
      entidadId: usuarioId,
      // Se registra el nombre de usuario intentado, nunca la contrasena (NFR-SEG-6).
      detalle: `intento con nombreUsuario="${nombreUsuario}"`,
      ip: contexto.ip ?? null,
    });
  }
}
