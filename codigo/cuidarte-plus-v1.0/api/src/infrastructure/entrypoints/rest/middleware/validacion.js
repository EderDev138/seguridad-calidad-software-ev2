import { DatosInvalidos } from '../../../../domain/error/errors.js';
import { logger } from '../../../config/logger.js';

/**
 * Validacion de entradas del lado del servidor (ERS §3.1.2, NFR-SEG-5).
 *
 * Toda peticion pasa por un esquema Zod antes de llegar al caso de uso. Esto
 * cumple dos propositos:
 *  1. Rechazar datos mal formados con un 400 y un mensaje util.
 *  2. Descartar los campos que no estan en el esquema (`strict`), lo que impide
 *     el mass assignment: enviar `{"rol":"ADMIN"}` en el registro ya no puede
 *     escalar privilegios porque el campo nunca llega al dominio.
 */
export function validar(esquema, origen = 'body') {
  return (req, _res, next) => {
    // Traza temporal para depurar los rechazos de validacion.
    logger.info({ ruta: req.originalUrl, [origen]: req[origen] }, 'Peticion recibida');

    const resultado = esquema.safeParse(req[origen]);
    if (!resultado.success) {
      const detalle = resultado.error.issues.map((issue) => ({
        campo: issue.path.join('.') || origen,
        problema: issue.message,
      }));
      return next(new DatosInvalidos('Los datos enviados no son validos', detalle));
    }
    // En Express 5 `req.query` es un getter sin setter, por lo que una
    // asignacion directa lanza TypeError. Se redefine la propiedad para dejar
    // en la peticion el valor ya validado y normalizado por el esquema.
    Object.defineProperty(req, origen, {
      value: resultado.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return next();
  };
}

/**
 * Escapa los caracteres con significado en HTML.
 *
 * El backend devuelve siempre texto plano y React escapa por defecto, de modo
 * que esta funcion es una defensa adicional para los puntos donde el texto se
 * incorpora a una respuesta que el navegador podria interpretar como HTML
 * (NFR-SEG-5, OWASP A03).
 */
export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (caracter) => {
    switch (caracter) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
