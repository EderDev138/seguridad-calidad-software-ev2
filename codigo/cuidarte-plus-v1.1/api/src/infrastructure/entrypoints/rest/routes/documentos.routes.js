import { Router } from 'express';
import { ROLES } from '../../../../domain/model/roles.js';
import { exigirRol, contextoDe } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc } from './comun.js';

/**
 * Rutas de documentos clinicos (ERS RF-4.2, RF-3.3).
 *
 * Permisos:
 *  - Descarga: usuario autenticado; el caso de uso sube por la cadena
 *    documento -> examen -> paciente para confirmar la titularidad, de modo
 *    que un paciente solo descarga lo propio (RB-1).
 *  - Eliminacion: solo MEDICO y ADMIN.
 */
export function rutasDocumentos({ casosDeUso, requiereSesion }) {
  const router = Router();

  router.use(requiereSesion);

  router.get(
    '/:id/descarga',
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      const { documento, contenido } = await casosDeUso.documentos.descargar(
        req.params.id,
        req.actor,
        contextoDe(req),
      );
      /*
       * `attachment` fuerza la descarga en vez del renderizado. Si el
       * navegador interpretara el archivo en el origen de la aplicacion, un
       * documento con contenido activo (SVG o HTML) se convertiria en un
       * vector de XSS almacenado. `nosniff` cierra la via alternativa de que
       * el navegador adivine otro tipo.
       */
      res.setHeader('Content-Type', documento.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${documento.nombreArchivo}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(contenido);
    }),
  );

  router.delete(
    '/:id',
    exigirRol(ROLES.ADMIN, ROLES.MEDICO),
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.documentos.eliminar(req.params.id, req.actor, contextoDe(req)));
    }),
  );

  return router;
}
