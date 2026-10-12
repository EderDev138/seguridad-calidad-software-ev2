import { Router } from 'express';
import { ROLES } from '../../../../domain/model/roles.js';
import { exigirRol, contextoDe } from '../middleware/autenticacion.js';
import { validar } from '../middleware/validacion.js';
import * as esquemas from '../schema/esquemas.js';
import { asinc } from './comun.js';

/**
 * Rutas de pacientes (ERS RF-2.2, RF-2.3, RF-2.4, RF-4.1).
 *
 * Permisos:
 *  - Lectura: cualquier usuario autenticado, pero el CASO DE USO filtra segun
 *    titularidad. Un paciente solo obtiene su propia ficha (RB-1); la
 *    restriccion no se puede expresar con `exigirRol` porque depende del dato,
 *    no del rol.
 *  - Escritura: solo MEDICO y ADMIN (RB-2, RB-3).
 */
export function rutasPacientes({ casosDeUso, requiereSesion }) {
  const router = Router();
  const soloClinico = exigirRol(ROLES.ADMIN, ROLES.MEDICO);

  router.use(requiereSesion);

  router.get(
    '/',
    asinc(async (req, res) => {
      res.json(await casosDeUso.pacientes.listar(req.actor));
    }),
  );

  router.get(
    '/:id',
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.pacientes.obtener(req.params.id, req.actor));
    }),
  );

  /**
   * RF-4.1 / NFR-USAB-4 — flujo escalonado: primero el paciente, luego sus
   * examenes. La ruta anidada materializa ese requisito de usabilidad y, de
   * paso, hereda el control de acceso de la ficha del paciente.
   */
  router.get(
    '/:pacienteId/examenes',
    validar(esquemas.esquemaPacienteIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.examenes.listarPorPaciente(req.params.pacienteId, req.actor));
    }),
  );

  router.post(
    '/',
    soloClinico,
    validar(esquemas.esquemaCrearPaciente),
    asinc(async (req, res) => {
      const paciente = await casosDeUso.pacientes.crear(req.body, req.actor, contextoDe(req));
      res.status(201).json(paciente);
    }),
  );

  router.put(
    '/:id',
    soloClinico,
    validar(esquemas.esquemaIdRuta, 'params'),
    validar(esquemas.esquemaActualizarPaciente),
    asinc(async (req, res) => {
      const paciente = await casosDeUso.pacientes.actualizar(
        req.params.id,
        req.body,
        req.actor,
        contextoDe(req),
      );
      res.json(paciente);
    }),
  );

  router.delete(
    '/:id',
    soloClinico,
    validar(esquemas.esquemaIdRuta, 'params'),
    asinc(async (req, res) => {
      res.json(await casosDeUso.pacientes.eliminar(req.params.id, req.actor, contextoDe(req)));
    }),
  );

  return router;
}
