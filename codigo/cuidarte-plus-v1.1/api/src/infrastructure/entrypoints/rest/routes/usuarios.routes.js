import { Router } from 'express';
import { ROLES } from '../../../../domain/model/roles.js';
import { exigirRol, contextoDe } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc } from './comun.js';

/**
 * Rutas de administracion de usuarios (ERS RF-2.5, RF-2.6, RF-2.7).
 *
 * Permisos: **todas** exigen rol ADMIN (RB-2). El router aplica `exigirRol` y
 * el caso de uso vuelve a verificarlo: defensa en profundidad, para que la
 * autorizacion no dependa de un unico punto.
 */
export function rutasUsuarios({ casosDeUso, requiereSesion }) {
  const router = Router();

  // Todas las rutas de este router comparten sesion y rol ADMIN.
  router.use(requiereSesion, exigirRol(ROLES.ADMIN));

  router.get(
    '/',
    asinc(async (req, res) => {
      res.json(await casosDeUso.usuarios.listar(req.actor));
    }),
  );

  router.get(
    '/:id',
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.usuarios.obtener(req.params.id, req.actor));
    }),
  );

  router.post(
    '/',
    validar(esquemas.esquemaCrearUsuario),
    asinc(async (req, res) => {
      const usuario = await casosDeUso.usuarios.crear(req.body, req.actor, contextoDe(req));
      res.status(201).json(usuario);
    }),
  );

  router.put(
    '/:id',
    validar(esquemas.esquemaIdRuta, 'params'),
    validar(esquemas.esquemaActualizarUsuario),
    asinc(async (req, res) => {
      const usuario = await casosDeUso.usuarios.actualizar(
        req.params.id,
        req.body,
        req.actor,
        contextoDe(req),
      );
      res.json(usuario);
    }),
  );

  router.delete(
    '/:id',
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.usuarios.eliminar(req.params.id, req.actor, contextoDe(req)));
    }),
  );

  return router;
}
