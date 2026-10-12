import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

/**
 * Cabeceras de seguridad HTTP (NFR-SEG-10 propuesto).
 *
 * Son las cabeceras que OWASP ZAP verifica en el escaneo pasivo y cuya
 * ausencia genero las alertas de la version 1.0 (incidente INC-06).
 *
 * | Cabecera                  | Protege contra                     |
 * |---------------------------|------------------------------------|
 * | Content-Security-Policy   | inyeccion y XSS                    |
 * | X-Content-Type-Options    | sniffing de tipo de contenido      |
 * | X-Frame-Options           | clickjacking                       |
 * | Strict-Transport-Security | degradacion a HTTP (NFR-SEG-1)     |
 * | Referrer-Policy           | fuga de URL por el referrer        |
 * | Permissions-Policy        | acceso a APIs del navegador        |
 */
export function cabecerasSeguridad() {
  return [
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: false },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
    (_req, res, next) => {
      res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
      // La cabecera por defecto de Express revela el framework y su version.
      res.removeHeader('X-Powered-By');
      next();
    },
  ];
}

/**
 * CORS restringido a los origenes declarados (NFR-SEG-5).
 *
 * `origin: '*'` junto con credenciales es precisamente lo que permite a un
 * sitio de terceros leer respuestas autenticadas; por eso la lista es
 * explicita y se configura por entorno.
 */
export function corsRestringido() {
  const permitidos = (process.env.CORS_ORIGENES ?? 'http://localhost:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

  return cors({
    origin(origen, callback) {
      // Sin cabecera Origin (curl, Postman, health checks) se permite.
      if (!origen || permitidos.includes(origen)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origen}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}

/**
 * Dimensionamiento del limite general de peticiones por IP.
 *
 * El valor NO es arbitrario: se deriva del propio requisito de concurrencia.
 *
 *   NFR-PERF-3  ->  200 usuarios concurrentes
 *   Supuesto     ->  60 peticiones/minuto por usuario en su momento de mayor
 *                    actividad (aproximadamente una accion por segundo)
 *   Limite       =   200 x 60 = 12.000 peticiones/minuto
 *   Con margen   =   15.000 peticiones/minuto
 *
 * Por que importa que sea POR IP y no por usuario: en un centro de salud todos
 * los equipos salen a internet por una misma direccion publica (NAT). Un
 * limite de 300 por minuto, que parece generoso para una persona, se reparte
 * entre los 200 usuarios del centro y les deja 1,5 peticiones por minuto a
 * cada uno. La medicion de carga de la EP02 detecto exactamente eso: latencias
 * holgadas pero la mitad de las peticiones rechazadas con HTTP 429.
 *
 * Es un ejemplo de control de seguridad que, mal dimensionado, incumple un
 * requisito de rendimiento y de disponibilidad. La proteccion contra fuerza
 * bruta se mantiene aparte, en `limitadorAutenticacion`, donde un limite
 * estricto si es correcto.
 *
 * En produccion este control pertenece al borde (WAF o API gateway), donde se
 * dispone de identidad por usuario y reputacion de IP; aqui se conserva como
 * defensa en profundidad.
 */
const LIMITE_GENERAL_POR_DEFECTO = 15_000;

/**
 * Limitador general de peticiones por IP (NFR-SEG-11 propuesto).
 * Amortigua el abuso automatizado y los escaneos agresivos.
 */
export function limitadorGeneral() {
  return rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.RATE_LIMIT_GENERAL ?? LIMITE_GENERAL_POR_DEFECTO),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    /*
     * El healthcheck queda fuera del limite.
     *
     * El monitoreo de disponibilidad consulta /salud cada pocos segundos desde
     * una misma direccion. Si esas consultas consumieran la cuota, el propio
     * sistema de monitoreo acabaria recibiendo 429 y reportando una caida
     * inexistente, o peor, consumiria la cuota de los usuarios reales
     * (NFR-DIS-1, NFR-DIS-3).
     */
    skip: (req) => req.path === '/salud' || req.originalUrl.endsWith('/api/v1/salud'),
    message: { error: 'DEMASIADAS_PETICIONES', mensaje: 'Limite de peticiones excedido' },
  });
}

/**
 * Limitador estricto para los endpoints de autenticacion.
 *
 * Es la primera barrera contra la fuerza bruta y el relleno de credenciales;
 * la segunda es el bloqueo por intentos fallidos del propio usuario (RF-1.3).
 */
export function limitadorAutenticacion() {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: Number(process.env.RATE_LIMIT_AUTH ?? 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: 'DEMASIADOS_INTENTOS',
      mensaje: 'Demasiados intentos de autenticacion. Reintente en unos minutos.',
    },
  });
}
