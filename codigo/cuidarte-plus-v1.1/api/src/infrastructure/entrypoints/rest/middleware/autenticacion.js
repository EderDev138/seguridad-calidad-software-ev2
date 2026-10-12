import { NoAutenticado, NoAutorizado } from '../../../../domain/error/errors.js';
import { verificar, extraerBearer } from '../../../security/token.js';

/**
 * Autenticacion por JWT (ERS RF-1.1, NFR-SEG-9).
 *
 * Deja en `req.actor` el sujeto autenticado, que es el unico origen de verdad
 * del rol para los middlewares de autorizacion. El rol NO se lee del cuerpo ni
 * de una cabecera enviada por el cliente.
 */
export function autenticar(sesionGateway, usuarioGateway) {
  return async (req, _res, next) => {
    try {
      const token = extraerBearer(req.headers.authorization);
      if (!token) {
        throw new NoAutenticado('Se requiere un token de acceso');
      }

      const payload = verificar(token, 'acceso');

      // Un token revocado en el logout debe dejar de servir de inmediato, aun
      // si no ha expirado (RF-1.2).
      if (await sesionGateway.estaRevocado(payload.jti)) {
        throw new NoAutenticado('La sesion fue cerrada');
      }

      // Se relee el usuario en cada peticion: si fue desactivado o eliminado
      // despues de emitir el token, el acceso cesa sin esperar la expiracion.
      const usuario = await usuarioGateway.obtenerPorId(Number(payload.sub));
      if (!usuario || !usuario.activo) {
        throw new NoAutenticado('La cuenta no esta disponible');
      }

      req.actor = { id: usuario.id, rol: usuario.rol, nombreUsuario: usuario.nombreUsuario };
      req.sesion = { jti: payload.jti, expiraEn: payload.exp };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Autorizacion por rol, aplicada EN EL BACKEND (NFR-SEG-4, RB-1/RB-2/RB-3).
 *
 * Ocultar un boton en React no es un control de acceso: la version 1.0 confiaba
 * en eso y permitia a un paciente escribir por API (incidente INC-04).
 *
 * @param {...string} rolesPermitidos
 */
export function exigirRol(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.actor) {
      return next(new NoAutenticado());
    }
    if (!rolesPermitidos.includes(req.actor.rol)) {
      return next(
        new NoAutorizado(
          `El rol ${req.actor.rol} no puede realizar esta operacion. Roles permitidos: ${rolesPermitidos.join(', ')}`,
        ),
      );
    }
    return next();
  };
}

/** Datos de contexto que se adjuntan a cada registro de auditoria. */
export function contextoDe(req) {
  return { ip: req.ip ?? null };
}
