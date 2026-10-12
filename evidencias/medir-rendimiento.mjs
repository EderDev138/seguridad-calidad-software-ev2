/**
 * Cuidarte+ · Medicion de rendimiento y carga
 * Casos CP-PERF-01, CP-PERF-02 y CP-PERF-03
 * Umbrales: NFR-PERF-1 (CRUD < 300 ms), NFR-PERF-2 (vista principal < 2 s),
 *           NFR-PERF-3 (200 usuarios concurrentes)
 *
 * Relacion con el plan de pruebas
 * -------------------------------
 * El artefacto formal del plan es `api/jmeter/cuidarte-carga.jmx`, que se
 * ejecuta con Apache JMeter y produce el informe HTML que la industria usa
 * como evidencia de carga.
 *
 * Este script cumple un proposito distinto y complementario: mide los mismos
 * umbrales SIN requerir la instalacion de JMeter, de modo que la medicion se
 * pueda reproducir en cualquier equipo que tenga Node. Es la herramienta con
 * la que se obtuvieron las cifras citadas en el informe; el plan de JMeter
 * queda disponible para la ejecucion formal en el ambiente de QA del cliente.
 *
 * Que mide
 * --------
 *  - Latencia por escenario: p50, p95, p99, media, minimo y maximo.
 *  - Tasa de error (respuestas != 2xx y fallos de red).
 *  - Rendimiento agregado (peticiones por segundo).
 *
 * Por que p95 y no el promedio: el promedio esconde la cola. Un servicio con
 * promedio de 80 ms puede tener un 5 % de peticiones sobre 2 s, y es ese 5 %
 * el que el usuario percibe como "el sistema se cuelga". Los umbrales del ERS
 * se evaluan sobre el p95.
 *
 * Uso:
 *   node medir-rendimiento.mjs [--usuarios 200] [--iteraciones 3] [--url http://localhost:3000/api/v1]
 */

import process from 'node:process';

const argumentos = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  argumentos.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const URL_BASE = argumentos.get('url') ?? 'http://localhost:3000/api/v1';
const USUARIOS = Number(argumentos.get('usuarios') ?? 200);
const ITERACIONES = Number(argumentos.get('iteraciones') ?? 3);
const USUARIO = argumentos.get('usuario') ?? 'medico1';
const CLAVE = argumentos.get('clave') ?? 'Cuidarte2026!';

/** Percentil por interpolacion del indice mas cercano. */
function percentil(valores, p) {
  if (valores.length === 0) {
    return Number.NaN;
  }
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, indice)];
}

function estadisticas(muestras) {
  const suma = muestras.reduce((acumulado, valor) => acumulado + valor, 0);
  return {
    n: muestras.length,
    media: suma / muestras.length,
    min: Math.min(...muestras),
    max: Math.max(...muestras),
    p50: percentil(muestras, 50),
    p95: percentil(muestras, 95),
    p99: percentil(muestras, 99),
  };
}

/** Ejecuta una peticion y devuelve su latencia y si fue exitosa. */
async function medirUna(ruta, token) {
  const inicio = performance.now();
  try {
    const respuesta = await fetch(`${URL_BASE}${ruta}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    // Se consume el cuerpo: sin esto la medicion excluye el tiempo de
    // transferencia y subestima la latencia real que percibe el cliente.
    await respuesta.arrayBuffer();
    return { ms: performance.now() - inicio, ok: respuesta.ok, status: respuesta.status };
  } catch (error) {
    return { ms: performance.now() - inicio, ok: false, status: 0, error: error.message };
  }
}

/**
 * Ejecuta un escenario con `USUARIOS` peticiones concurrentes, repetido
 * `ITERACIONES` veces.
 */
async function ejecutarEscenario(nombre, ruta, token, umbral, requisito) {
  const latencias = [];
  let errores = 0;
  const inicioTotal = performance.now();

  for (let iteracion = 0; iteracion < ITERACIONES; iteracion += 1) {
    const lote = Array.from({ length: USUARIOS }, () => medirUna(ruta, token));
    const resultados = await Promise.all(lote);
    for (const resultado of resultados) {
      latencias.push(resultado.ms);
      if (!resultado.ok) {
        errores += 1;
      }
    }
  }

  const duracionSegundos = (performance.now() - inicioTotal) / 1000;
  const stats = estadisticas(latencias);
  const tasaError = (errores / latencias.length) * 100;
  const cumple = stats.p95 <= umbral && tasaError === 0;

  return { nombre, ruta, requisito, umbral, stats, tasaError, cumple, rps: latencias.length / duracionSegundos };
}

function formatear(resultado) {
  const { nombre, requisito, umbral, stats, tasaError, cumple, rps } = resultado;
  return [
    `Escenario   : ${nombre}`,
    `Requisito   : ${requisito}`,
    `Umbral      : p95 <= ${umbral} ms`,
    `Peticiones  : ${stats.n}  (${USUARIOS} concurrentes x ${ITERACIONES} iteraciones)`,
    `Latencia    : p50 ${stats.p50.toFixed(0)} ms | p95 ${stats.p95.toFixed(0)} ms | ` +
      `p99 ${stats.p99.toFixed(0)} ms | media ${stats.media.toFixed(0)} ms | ` +
      `min ${stats.min.toFixed(0)} ms | max ${stats.max.toFixed(0)} ms`,
    `Errores     : ${tasaError.toFixed(2)} %`,
    `Rendimiento : ${rps.toFixed(0)} peticiones/s`,
    `Veredicto   : ${cumple ? 'CUMPLE' : 'NO CUMPLE'}`,
    '',
  ].join('\n');
}

async function main() {
  process.stdout.write(
    [
      '=====================================================================',
      'Cuidarte+ · Medicion de rendimiento y carga',
      '=====================================================================',
      `URL base       : ${URL_BASE}`,
      `Concurrencia   : ${USUARIOS} usuarios simultaneos (NFR-PERF-3)`,
      `Iteraciones    : ${ITERACIONES}`,
      `Instante       : ${new Date().toISOString()}`,
      '',
      'Nota: la medicion se realiza desde el mismo equipo que aloja los',
      'contenedores, por lo que no incluye latencia de red. Las cifras miden',
      'el tiempo de proceso del servidor, que es lo que los umbrales del ERS',
      'acotan.',
      '',
    ].join('\n'),
  );

  // Autenticacion previa: las rutas medidas requieren sesion, y se quiere
  // medir el costo real (verificacion de token incluida).
  const respuestaLogin = await fetch(`${URL_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombreUsuario: USUARIO, password: CLAVE }),
  });
  if (!respuestaLogin.ok) {
    process.stderr.write(
      `No fue posible autenticarse como ${USUARIO} (HTTP ${respuestaLogin.status}). ` +
        'Verifique que el ambiente este levantado y con datos de prueba cargados.\n',
    );
    process.exit(1);
  }
  const { token } = await respuestaLogin.json();

  const escenarios = [
    // CP-PERF-01 · vista principal: el listado que abre el usuario al entrar.
    ['Listado de pacientes (vista principal)', '/pacientes', 2000, 'NFR-PERF-2'],
    // CP-PERF-02 · operacion CRUD simple sobre un recurso anidado.
    ['Examenes de un paciente (CRUD simple)', '/pacientes/1/examenes', 300, 'NFR-PERF-1'],
    // Linea base: sin acceso a base de datos ni verificacion de token.
    ['Healthcheck (linea base del servicio)', '/salud', 300, 'NFR-DIS-3'],
  ];

  const resultados = [];
  for (const [nombre, ruta, umbral, requisito] of escenarios) {
    const resultado = await ejecutarEscenario(nombre, ruta, token, umbral, requisito);
    resultados.push(resultado);
    process.stdout.write(formatear(resultado));
  }

  // Resumen en tabla, listo para copiar al informe.
  process.stdout.write(
    [
      '---------------------------------------------------------------------',
      'RESUMEN',
      '---------------------------------------------------------------------',
      'ESCENARIO'.padEnd(42) + 'REQUISITO'.padEnd(13) + 'UMBRAL'.padEnd(10) + 'p95'.padEnd(10) + 'VEREDICTO',
      '-'.repeat(85),
      ...resultados.map(
        (r) =>
          r.nombre.padEnd(42) +
          r.requisito.padEnd(13) +
          `${r.umbral} ms`.padEnd(10) +
          `${r.stats.p95.toFixed(0)} ms`.padEnd(10) +
          (r.cumple ? 'CUMPLE' : 'NO CUMPLE'),
      ),
      '',
    ].join('\n'),
  );

  const incumplen = resultados.filter((r) => !r.cumple);
  if (incumplen.length > 0) {
    process.stdout.write(
      `Resultado: ${incumplen.length} escenario(s) NO CUMPLEN el umbral del ERS.\n`,
    );
    process.exit(1);
  }
  process.stdout.write('Resultado: todos los escenarios cumplen los umbrales del ERS.\n');
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(2);
});
