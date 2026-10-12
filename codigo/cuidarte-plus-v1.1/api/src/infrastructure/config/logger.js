import pino from 'pino';

/**
 * Logger estructurado (NFR-SEG-6, NFR-SEG-15 propuesto).
 *
 * La configuracion mas importante es `redact`: las rutas listadas se
 * reemplazan por [REDACTED] antes de escribirse. En la version 1.0 el log
 * imprimia el cuerpo completo del login, es decir la contrasena en claro
 * (incidente INC-05), lo que incumple el deber de seguridad del tratamiento
 * de datos personales de la Ley 19.628 / 21.719.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordActual',
      'req.body.refreshToken',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  // Formato ISO para que los registros sean correlacionables con la auditoria.
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Datos de la peticion que se registran.
 *
 * No se registra el cuerpo: en esta aplicacion el cuerpo contiene datos
 * clinicos y personales, y conservarlos en el log seria tratarlos sin
 * finalidad legitima (principio de minimizacion).
 */
export const opcionesLogHttp = {
  logger,
  serializers: {
    req(req) {
      return { metodo: req.method, url: req.url, ip: req.raw?.ip ?? undefined };
    },
    res(res) {
      return { status: res.statusCode };
    },
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
};
