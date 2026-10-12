import { Given, When, Then, Before, setDefaultTimeout } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

import { crearEntorno, sembrarEscenarioClinico } from '../../soporte/entorno.js';
import { ACCIONES_AUDITABLES } from '../../../src/domain/model/roles.js';

/**
 * Definiciones de pasos (glue) de los escenarios BDD.
 *
 * Los escenarios se escriben en lenguaje natural para que un stakeholder no
 * tecnico pueda validar el COMPORTAMIENTO esperado; estos pasos los traducen a
 * llamadas sobre los casos de uso.
 *
 * Importante: el glue invoca los CASOS DE USO directamente (no HTTP). Asi los
 * escenarios describen reglas de negocio y no detalles de transporte, y siguen
 * siendo validos si manana la API cambia de REST a otra cosa.
 */
setDefaultTimeout(30_000);

let entorno;
let escenario;
let actores;
let ultimoError;
let ultimoResultado;

/** Traduce el nombre completo que usa el .feature al actor y paciente reales. */
function pacientePorNombre(nombre) {
  if (nombre === 'Ana Perez') {
    return { ficha: escenario.paciente, cuenta: escenario.cuentaPaciente };
  }
  if (nombre === 'Bruno Soto') {
    return { ficha: escenario.otroPaciente, cuenta: escenario.otraCuentaPaciente };
  }
  throw new Error(`Paciente no definido en el escenario: ${nombre}`);
}

/** Ejecuta una accion capturando el error, para poder afirmar sobre el rechazo. */
async function intentar(accion) {
  ultimoError = null;
  ultimoResultado = null;
  try {
    ultimoResultado = await accion();
  } catch (error) {
    ultimoError = error;
  }
}

Before(async () => {
  entorno = await crearEntorno();
  escenario = await sembrarEscenarioClinico(entorno.gateways);
  // Los actores son el "sujeto autenticado" que recibe cada caso de uso.
  actores = {
    admin: { id: escenario.admin.id, rol: escenario.admin.rol },
    medico: { id: escenario.medico.id, rol: escenario.medico.rol },
    ana: { id: escenario.cuentaPaciente.id, rol: escenario.cuentaPaciente.rol },
    bruno: { id: escenario.otraCuentaPaciente.id, rol: escenario.otraCuentaPaciente.rol },
  };
  ultimoError = null;
  ultimoResultado = null;
  // El escenario base siembra un examen; se elimina para partir de cero y que
  // los conteos de cada escenario sean explicitos.
  await entorno.gateways.examenGateway.eliminar(escenario.examen.id);
});

Given('un centro de salud con un medico, un administrador y dos pacientes registrados', () => {
  assert.ok(actores.medico.id, 'el medico debe existir');
  assert.ok(actores.admin.id, 'el administrador debe existir');
  assert.ok(escenario.paciente.id && escenario.otroPaciente.id, 'deben existir dos pacientes');
});

Given('que el medico registro un examen {string} al paciente {string}', async (tipo, nombre) => {
  const { ficha } = pacientePorNombre(nombre);
  await entorno.casosDeUso.examenes.crear({ pacienteId: ficha.id, tipo }, actores.medico);
});

When('el medico registra un examen {string} al paciente {string}', async (tipo, nombre) => {
  const { ficha } = pacientePorNombre(nombre);
  await intentar(() =>
    entorno.casosDeUso.examenes.crear({ pacienteId: ficha.id, tipo }, actores.medico),
  );
});

When('el paciente {string} intenta registrar un examen {string}', async (nombre, tipo) => {
  const { ficha, cuenta } = pacientePorNombre(nombre);
  await intentar(() =>
    entorno.casosDeUso.examenes.crear(
      { pacienteId: ficha.id, tipo },
      {
        id: cuenta.id,
        rol: cuenta.rol,
      },
    ),
  );
});

When('el paciente {string} consulta sus examenes', async (nombre) => {
  const { ficha, cuenta } = pacientePorNombre(nombre);
  await intentar(() =>
    entorno.casosDeUso.examenes.listarPorPaciente(ficha.id, { id: cuenta.id, rol: cuenta.rol }),
  );
});

When(
  'el paciente {string} intenta consultar los examenes de {string}',
  async (solicitante, objetivo) => {
    const { cuenta } = pacientePorNombre(solicitante);
    const { ficha } = pacientePorNombre(objetivo);
    await intentar(() =>
      entorno.casosDeUso.examenes.listarPorPaciente(ficha.id, { id: cuenta.id, rol: cuenta.rol }),
    );
  },
);

When('el medico elimina ese examen', async () => {
  const examenes = await entorno.gateways.examenGateway.listarPorPaciente(escenario.paciente.id);
  assert.ok(examenes.length > 0, 'debe existir un examen para eliminar');
  escenario.examenEliminado = examenes[0];
  await intentar(() => entorno.casosDeUso.examenes.eliminar(examenes[0].id, actores.medico));
});

When('el paciente {string} intenta consultar la auditoria', async (nombre) => {
  const { cuenta } = pacientePorNombre(nombre);
  await intentar(() => entorno.casosDeUso.auditoria.listar({}, { id: cuenta.id, rol: cuenta.rol }));
});

Then('el examen queda registrado para {string}', async (nombre) => {
  assert.equal(ultimoError, null, `no se esperaba un error: ${ultimoError?.message}`);
  const { ficha } = pacientePorNombre(nombre);
  const examenes = await entorno.gateways.examenGateway.listarPorPaciente(ficha.id);
  assert.equal(examenes.length, 1);
});

Then('la operacion es rechazada por falta de permisos', () => {
  assert.ok(ultimoError, 'se esperaba que la operacion fuera rechazada');
  assert.equal(
    ultimoError.codigo,
    'NO_AUTORIZADO',
    `se esperaba NO_AUTORIZADO y se obtuvo ${ultimoError.codigo}`,
  );
});

Then('{string} no tiene examenes registrados', async (nombre) => {
  const { ficha } = pacientePorNombre(nombre);
  const examenes = await entorno.gateways.examenGateway.listarPorPaciente(ficha.id);
  assert.equal(examenes.length, 0);
});

Then('obtiene {int} examen(es)', (cantidad) => {
  assert.equal(ultimoError, null, `no se esperaba un error: ${ultimoError?.message}`);
  assert.equal(ultimoResultado.length, cantidad);
});

Then('entre sus examenes no aparece {string}', (tipo) => {
  const tipos = ultimoResultado.map((examen) => examen.tipo);
  assert.ok(!tipos.includes(tipo), `no deberia ver el examen ${tipo}`);
});

Then('la consulta no devuelve informacion del otro paciente', () => {
  // El caso de uso responde NO_ENCONTRADO en vez de NO_AUTORIZADO: de ese modo
  // tampoco se confirma que la ficha ajena exista.
  assert.ok(ultimoError, 'se esperaba que la consulta fuera rechazada');
  assert.equal(ultimoError.codigo, 'NO_ENCONTRADO');
  assert.equal(ultimoResultado, null);
});

Then('el examen deja de aparecer entre los examenes activos', async () => {
  const activos = await entorno.gateways.examenGateway.listarPorPaciente(escenario.paciente.id);
  const ids = activos.map((examen) => examen.id);
  assert.ok(!ids.includes(escenario.examenEliminado.id));
});

Then('el registro del examen se conserva marcado como eliminado', () => {
  const conservado = entorno.gateways.examenGateway.obtenerIncluyendoEliminados(
    escenario.examenEliminado.id,
  );
  assert.ok(conservado, 'el registro no debe borrarse fisicamente (RF-3.3)');
  assert.ok(conservado.eliminadoEn, 'debe quedar marcado con la fecha de baja');
});

Then('la auditoria contiene la accion {string}', async (accion) => {
  assert.ok(
    Object.values(ACCIONES_AUDITABLES).includes(accion),
    `accion no declarada en el dominio: ${accion}`,
  );
  const registros = await entorno.gateways.auditoriaGateway.listar({ accion, limite: 500 });
  assert.ok(registros.length > 0, `no se registro la accion ${accion} en auditoria`);
});

Then('el administrador si puede consultar la auditoria', async () => {
  const registros = await entorno.casosDeUso.auditoria.listar({}, actores.admin);
  assert.ok(Array.isArray(registros), 'el administrador debe obtener el listado');
});
