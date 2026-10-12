import path from 'node:path';
import { crearApp, crearCasosDeUso } from './app.js';
import { crearPool, aplicarEsquema } from './infrastructure/adapters/postgres/pool.js';
import {
  UsuarioGatewayPg,
  PacienteGatewayPg,
  ExamenGatewayPg,
  DocumentoGatewayPg,
  AuditoriaGatewayPg,
  SesionGatewayPg,
} from './infrastructure/adapters/postgres/gatewaysPostgres.js';
import { StorageLocal } from './infrastructure/storage/StorageLocal.js';
import { logger } from './infrastructure/config/logger.js';

/**
 * Punto de arranque del servicio.
 *
 * Verifica las precondiciones de seguridad ANTES de escuchar: si falta el
 * secreto de JWT o la cadena de conexion, el proceso termina. Arrancar
 * "degradado" con valores por defecto es lo que produce sistemas con
 * credenciales conocidas en produccion (NFR-SEG-13).
 */
const PUERTO = Number(process.env.PORT ?? 3000);

function verificarConfiguracion() {
  const faltantes = ['DATABASE_URL', 'JWT_SECRET'].filter((clave) => !process.env[clave]);
  if (faltantes.length > 0) {
    logger.fatal(
      { faltantes },
      'Faltan variables de entorno obligatorias. Revise .env.example y NFR-SEG-13.',
    );
    process.exit(1);
  }
}

async function main() {
  verificarConfiguracion();

  const pool = crearPool();
  await aplicarEsquema(pool);
  logger.info('Esquema de base de datos verificado');

  const gateways = {
    usuarioGateway: new UsuarioGatewayPg(pool),
    pacienteGateway: new PacienteGatewayPg(pool),
    examenGateway: new ExamenGatewayPg(pool),
    documentoGateway: new DocumentoGatewayPg(pool),
    auditoriaGateway: new AuditoriaGatewayPg(pool),
    sesionGateway: new SesionGatewayPg(),
  };

  const storage = new StorageLocal(
    process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage-documentos'),
  );
  await storage.inicializar();

  const casosDeUso = crearCasosDeUso({ gateways, storage });
  const app = crearApp({ casosDeUso, gateways });

  const servidor = app.listen(PUERTO, () => {
    logger.info(`API de Cuidarte+ escuchando en http://localhost:${PUERTO}/api/v1`);
  });

  /**
   * Apagado ordenado: deja de aceptar conexiones, cierra el pool y solo
   * entonces termina. Es lo que permite desplegar dentro de la ventana de
   * mantenimiento sin cortar peticiones en curso (NFR-DIS-2).
   */
  const apagar = async (senal) => {
    logger.info({ senal }, 'Apagado ordenado iniciado');
    servidor.close(async () => {
      await pool.end();
      logger.info('Recursos liberados. Proceso finalizado.');
      process.exit(0);
    });
    // Red de seguridad: si algo queda colgado, se fuerza la salida.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'No fue posible iniciar el servicio');
  process.exit(1);
});
