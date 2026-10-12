import express from 'express';
import pinoHttp from 'pino-http';

import { AuthUseCase } from './application/usecase/AuthUseCase.js';
import { UsuarioUseCase } from './application/usecase/UsuarioUseCase.js';
import { PacienteUseCase } from './application/usecase/PacienteUseCase.js';
import { ExamenUseCase } from './application/usecase/ExamenUseCase.js';
import { DocumentoUseCase } from './application/usecase/DocumentoUseCase.js';
import { AuditoriaUseCase } from './application/usecase/AuditoriaUseCase.js';

import { crearRutas } from './infrastructure/entrypoints/rest/routes/index.js';
import {
  errorHandler,
  notFoundHandler,
} from './infrastructure/entrypoints/rest/middleware/errorHandler.js';
import {
  corsAbierto,
  limitadorGeneral,
} from './infrastructure/entrypoints/rest/middleware/seguridad.js';
import { logger, opcionesLogHttp } from './infrastructure/config/logger.js';

import * as password from './infrastructure/security/password.js';
import * as token from './infrastructure/security/token.js';

/**
 * Composicion de los casos de uso a partir de los puertos.
 *
 * Es el unico punto del sistema que conoce a la vez el dominio y la
 * infraestructura. Separarlo asi permite armar la aplicacion con gateways en
 * memoria (pruebas) o con PostgreSQL (QA y produccion) sin tocar nada mas.
 */
export function crearCasosDeUso({ gateways, storage }) {
  const pacientes = new PacienteUseCase({
    pacienteGateway: gateways.pacienteGateway,
    auditoriaGateway: gateways.auditoriaGateway,
  });

  const examenes = new ExamenUseCase({
    examenGateway: gateways.examenGateway,
    pacienteUseCase: pacientes,
    auditoriaGateway: gateways.auditoriaGateway,
  });

  return {
    auth: new AuthUseCase({
      usuarioGateway: gateways.usuarioGateway,
      sesionGateway: gateways.sesionGateway,
      auditoriaGateway: gateways.auditoriaGateway,
      password,
      token,
    }),
    usuarios: new UsuarioUseCase({
      usuarioGateway: gateways.usuarioGateway,
      auditoriaGateway: gateways.auditoriaGateway,
      password,
    }),
    pacientes,
    examenes,
    documentos: new DocumentoUseCase({
      documentoGateway: gateways.documentoGateway,
      examenUseCase: examenes,
      storage,
      auditoriaGateway: gateways.auditoriaGateway,
    }),
    auditoria: new AuditoriaUseCase({ auditoriaGateway: gateways.auditoriaGateway }),
  };
}

/**
 * Construye la aplicacion Express.
 *
 * El orden de los middlewares es deliberado y es en si mismo un control de
 * seguridad:
 *   1. `trust proxy` para que `req.ip` sea real detras del balanceador
 *      (de lo contrario el rate limit y la auditoria registran la IP del proxy).
 *   2. Cabeceras de seguridad antes que cualquier respuesta.
 *   3. CORS restringido antes de procesar el cuerpo.
 *   4. Limite de tamano del cuerpo JSON (anti denegacion de servicio).
 *   5. Rutas.
 *   6. 404 y, al final, el manejador de errores.
 */
export function crearApp({ casosDeUso, gateways, servirEstaticos = null }) {
  const app = express();

  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

  if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp(opcionesLogHttp));
  }

  // TODO: revisar las cabeceras de seguridad antes de pasar a produccion.
  app.use(corsAbierto());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(limitadorGeneral());

  app.use('/api/v1', crearRutas({ casosDeUso, gateways }));

  if (servirEstaticos) {
    app.use(express.static(servirEstaticos, { index: 'index.html', maxAge: '1h' }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
