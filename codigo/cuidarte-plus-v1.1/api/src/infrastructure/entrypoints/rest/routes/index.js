import { Router } from 'express';
import { ROLES } from '../../../../domain/model/roles.js';
import { autenticar, exigirRol } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc } from './comun.js';

import { rutasAuth } from './auth.routes.js';
import { rutasUsuarios } from './usuarios.routes.js';
import { rutasPacientes } from './pacientes.routes.js';
import { rutasExamenes } from './examenes.routes.js';
import { rutasDocumentos } from './documentos.routes.js';

/**
 * Composicion de la API REST de Cuidarte+ (ERS §3.1.2).
 *
 * Criterio de diseno: cada router declara explicitamente (a) su esquema de
 * validacion y (b) los roles que pueden invocar cada operacion. No hay
 * autorizacion implicita en ninguna ruta.
 *
 * MATRIZ DE PERMISOS (NFR-SEG-4, RB-1 / RB-2 / RB-3)
 *
 * | Recurso                        | ADMIN | MEDICO | PACIENTE        | Anonimo |
 * |--------------------------------|-------|--------|-----------------|---------|
 * | POST /auth/registro            |  si   |  si    | si              |  si     |
 * | POST /auth/login, /refresh     |  si   |  si    | si              |  si     |
 * | POST /auth/logout, GET /auth/yo|  si   |  si    | si              |  no     |
 * | GET  /salud                    |  si   |  si    | si              |  si     |
 * | *    /usuarios                 |  si   |  no    | no              |  no     |
 * | GET  /pacientes                |  todos|  todos | solo su ficha   |  no     |
 * | POST,PUT,DELETE /pacientes     |  si   |  si    | no              |  no     |
 * | GET  /pacientes/:id/examenes   |  todos|  todos | solo los suyos  |  no     |
 * | GET  /examenes/:id             |  todos|  todos | solo los suyos  |  no     |
 * | POST,PUT,DELETE /examenes      |  si   |  si    | no              |  no     |
 * | POST /examenes/:id/documentos  |  si   |  si    | no              |  no     |
 * | GET  /documentos/:id/descarga  |  todos|  todos | solo los suyos  |  no     |
 * | DELETE /documentos/:id         |  si   |  si    | no              |  no     |
 * | *    /auditoria                |  si   |  no    | no              |  no     |
 *
 * "solo los suyos" es autorizacion que depende del DATO y no del rol, por lo
 * que no puede resolverse con un middleware: la aplican los casos de uso
 * verificando la titularidad de la ficha del paciente.
 */
export function crearRutas({ casosDeUso, gateways }) {
  const router = Router();
  const requiereSesion = autenticar(gateways.sesionGateway, gateways.usuarioGateway);
  const dependencias = { casosDeUso, requiereSesion };

  // -------------------------------------------------------------------------
  // Salud del servicio (NFR-DIS-1, NFR-DIS-3 propuesto) · publico
  // -------------------------------------------------------------------------
  router.get(
    '/salud',
    asinc(async (_req, res) => {
      res.json({
        estado: 'operativo',
        version: process.env.APP_VERSION ?? '1.1.0',
        instante: new Date().toISOString(),
      });
    }),
  );

  router.use('/auth', rutasAuth(dependencias));
  router.use('/usuarios', rutasUsuarios(dependencias));
  router.use('/pacientes', rutasPacientes(dependencias));
  router.use('/examenes', rutasExamenes(dependencias));
  router.use('/documentos', rutasDocumentos(dependencias));

  // -------------------------------------------------------------------------
  // RF-5 Auditoria · solo ADMIN
  // Se mantiene aqui por ser un unico recurso de dos operaciones de lectura.
  // -------------------------------------------------------------------------
  router.get(
    '/auditoria',
    requiereSesion,
    exigirRol(ROLES.ADMIN),
    validar(esquemas.esquemaFiltroAuditoria, 'query'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.auditoria.listar(req.query, req.actor));
    }),
  );

  router.get(
    '/auditoria/exportar',
    requiereSesion,
    exigirRol(ROLES.ADMIN),
    validar(esquemas.esquemaFiltroAuditoria, 'query'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.auditoria.exportar(req.query, req.actor));
    }),
  );

  return router;
}
