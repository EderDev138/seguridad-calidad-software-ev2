import { Router } from 'express';
import { ROLES } from '../../../../domain/model/roles.js';
import { DatosInvalidos } from '../../../../domain/error/errors.js';
import { exigirRol, contextoDe } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc, crearSubidor } from './comun.js';

/**
 * Rutas de examenes medicos y de sus documentos adjuntos
 * (ERS RF-3.1 a RF-3.3, RF-4.3, RF-4.4).
 *
 * Permisos:
 *  - Lectura del examen y de su lista de documentos: usuario autenticado, con
 *    el filtro de titularidad en el caso de uso (RB-1).
 *  - Escritura y adjuntos: solo MEDICO y ADMIN (RB-2, RB-3).
 */
export function rutasExamenes({ casosDeUso, requiereSesion }) {
  const router = Router();
  const subidor = crearSubidor();
  // La interfaz solo muestra las acciones de escritura al personal clinico.
  const soloClinico = (_req, _res, next) => next();

  router.use(requiereSesion);

  router.get(
    '/:id',
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.examenes.obtener(req.params.id, req.actor));
    }),
  );

  router.post(
    '/',
    soloClinico,
    validar(esquemas.esquemaCrearExamen),
    asinc(async (req, res) => {
      const examen = await casosDeUso.examenes.crear(req.body, req.actor, contextoDe(req));
      res.status(201).json(examen);
    }),
  );

  router.put(
    '/:id',
    soloClinico,
    validar(esquemas.esquemaIdRuta, 'params'),
    validar(esquemas.esquemaActualizarExamen),
    asinc(async (req, res) => {
      const examen = await casosDeUso.examenes.actualizar(
        req.params.id,
        req.body,
        req.actor,
        contextoDe(req),
      );
      res.json(examen);
    }),
  );

  /** RF-3.3 — baja LOGICA del examen; el registro se conserva para auditoria. */
  router.delete(
    '/:id',
    soloClinico,
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.examenes.eliminar(req.params.id, req.actor, contextoDe(req)));
    }),
  );

  // --- Documentos adjuntos al examen ---------------------------------------

  router.get(
    '/:examenId/documentos',
    validar(esquemas.esquemaExamenIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.documentos.listarPorExamen(req.params.examenId, req.actor));
    }),
  );

  router.post(
    '/:examenId/documentos',
    soloClinico,
    validar(esquemas.esquemaExamenIdRuta, 'params'),
    subidor.single('archivo'),
    asinc(async (req, res) => {
      if (!req.file) {
        throw new DatosInvalidos('Debe adjuntar un archivo en el campo "archivo"');
      }
      const documento = await casosDeUso.documentos.adjuntar(
        {
          examenId: req.params.examenId,
          nombreArchivo: req.file.originalname,
          mime: req.file.mimetype,
          contenido: req.file.buffer,
        },
        req.actor,
        contextoDe(req),
      );
      res.status(201).json(documento);
    }),
  );

  return router;
}
