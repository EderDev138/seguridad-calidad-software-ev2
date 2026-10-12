import { Router } from 'express';
import { contextoDe } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import { limitadorAutenticacion } from '../middleware/seguridad.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc } from './comun.js';

/**
 * Rutas de autenticacion y sesion (ERS RF-1, RF-2.1).
 *
 * Permisos: `registro`, `login` y `refresh` son publicos por definicion;
 * `logout` y `yo` exigen sesion vigente.
 *
 * Los endpoints publicos llevan `limitadorAutenticacion()` para amortiguar la
 * fuerza bruta y el relleno de credenciales (NFR-SEG-11).
 */
export function rutasAuth({ casosDeUso, requiereSesion }) {
  const router = Router();

  router.post(
    '/registro',
    limitadorAutenticacion(),
    validar(esquemas.esquemaRegistro),
    asinc(async (req, res) => {
      const usuario = await casosDeUso.auth.registrar(req.body, contextoDe(req));
      res.status(201).json(usuario);
    }),
  );

  router.post(
    '/login',
    limitadorAutenticacion(),
    validar(esquemas.esquemaLogin),
    asinc(async (req, res) => {
      const sesion = await casosDeUso.auth.login(req.body, contextoDe(req));
      res.json(sesion);
    }),
  );

  router.post(
    '/logout',
    requiereSesion,
    asinc(async (req, res) => {
      const resultado = await casosDeUso.auth.logout(
        { jti: req.sesion.jti, expiraEn: req.sesion.expiraEn, usuarioId: req.actor.id },
        contextoDe(req),
      );
      res.json(resultado);
    }),
  );

  router.post(
    '/refresh',
    validar(esquemas.esquemaRefresh),
    asinc(async (req, res) => {
      res.json(await casosDeUso.auth.refrescar(req.body.refreshToken));
    }),
  );

  /** Perfil del usuario autenticado; lo usa la SPA para resolver su menu. */
  router.get(
    '/yo',
    requiereSesion,
    asinc(async (req, res) => {
      res.json(req.actor);
    }),
  );

  return router;
}
