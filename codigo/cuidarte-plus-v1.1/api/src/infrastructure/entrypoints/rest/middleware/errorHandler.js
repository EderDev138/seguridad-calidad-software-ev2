import { ErrorDominio } from '../../../../domain/error/errors.js';

/**
 * Traduccion de errores de dominio a codigos HTTP.
 *
 * Mantener esta tabla en un solo lugar evita el problema detectado en la
 * version 1.0, donde un duplicado de RUT terminaba en un 500 opaco en vez del
 * 409 que corresponde (incidente INC-01).
 */
const STATUS_POR_CODIGO = {
  NO_ENCONTRADO: 404,
  DUPLICADO: 409,
  DATOS_INVALIDOS: 400,
  NO_AUTENTICADO: 401,
  NO_AUTORIZADO: 403,
  CONFLICTO: 409,
  DEMASIADOS_INTENTOS: 429,
};

/** Respuesta para un error de negocio previsto por el dominio. */
function responderErrorDominio(error, req, res, logger) {
  const status = STATUS_POR_CODIGO[error.codigo] ?? 400;
  if (status >= 500) {
    logger.error({ err: error }, 'Error de dominio con status 5xx');
  } else {
    logger.warn({ codigo: error.codigo, ruta: req.originalUrl }, error.message);
  }
  return res.status(status).json({
    error: error.codigo,
    mensaje: error.message,
    detalle: error.detalle,
  });
}

/**
 * Respuesta para los errores de multer (subida de documentos).
 * @returns {boolean} true si el error fue atendido aqui
 */
function responderErrorSubida(error, res) {
  if (error?.code !== 'LIMIT_FILE_SIZE') {
    return false;
  }
  res.status(413).json({
    error: 'ARCHIVO_DEMASIADO_GRANDE',
    mensaje: 'El documento excede el tamano maximo permitido (10 MB)',
  });
  return true;
}

/**
 * Respuesta para los errores de `express.json()` / `express.urlencoded()`:
 * cuerpo que excede el limite de 100 kb (`entity.too.large`) o JSON mal
 * formado.
 *
 * Sin esta rama terminaban en el 500 generico, lo que (a) oculta que el
 * rechazo fue por una validacion de entrada y (b) dispara alertas de error
 * interno ante un simple abuso de tamano.
 *
 * @returns {boolean} true si el error fue atendido aqui
 */
function responderErrorDeCuerpo(error, req, res, logger) {
  const status = error?.status ?? error?.statusCode;
  if (!Number.isInteger(status) || status < 400 || status >= 500) {
    return false;
  }
  logger.warn(
    { tipo: error.type, status, ruta: req.originalUrl },
    'Peticion rechazada al interpretar el cuerpo',
  );
  const demasiadoGrande = error.type === 'entity.too.large';
  res.status(status).json({
    error: demasiadoGrande ? 'CUERPO_DEMASIADO_GRANDE' : 'PETICION_INVALIDA',
    mensaje: demasiadoGrande
      ? 'El cuerpo de la peticion excede el limite permitido (100 kb)'
      : 'El cuerpo de la peticion no se pudo interpretar',
  });
  return true;
}

/**
 * Middleware final de errores.
 *
 * Al cliente se le entrega un mensaje util pero nunca el stack ni el detalle
 * interno del motor de base de datos: filtrar esa informacion facilita la
 * explotacion (OWASP A05, NFR-SEG-6). El detalle completo va al log del
 * servidor, que es donde corresponde.
 */
export function errorHandler(logger) {
  return (error, req, res, _next) => {
    if (error instanceof ErrorDominio) {
      return responderErrorDominio(error, req, res, logger);
    }
    if (responderErrorSubida(error, res)) {
      return undefined;
    }
    if (responderErrorDeCuerpo(error, req, res, logger)) {
      return undefined;
    }

    logger.error({ err: error, ruta: req.originalUrl }, 'Error no controlado');
    return res.status(500).json({
      error: 'ERROR_INTERNO',
      mensaje: 'Ocurrio un error inesperado. Si persiste, contacte al administrador.',
    });
  };
}

/** Manejador de rutas inexistentes. */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'RUTA_NO_ENCONTRADA',
    mensaje: `No existe el recurso ${req.method} ${req.originalUrl}`,
  });
}
