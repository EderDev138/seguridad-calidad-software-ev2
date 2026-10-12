import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

/**
 * Pool de conexiones a PostgreSQL.
 *
 * La credencial se toma SIEMPRE del entorno (NFR-SEG-13): no existe un valor
 * por defecto con usuario y clave, porque un default conocido es una
 * credencial publicada.
 */
export function crearPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no definida. Configure la conexion por variable de entorno (NFR-SEG-13).',
    );
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // TLS obligatorio salvo en el ambiente local de QA (NFR-SEG-1).
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
}

/** Aplica el esquema de forma idempotente al arrancar. */
export async function aplicarEsquema(pool) {
  const sql = await fs.readFile(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
