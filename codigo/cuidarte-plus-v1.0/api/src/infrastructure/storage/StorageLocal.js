import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Storage interno de documentos clinicos (ERS RF-4.4, restriccion §2.4).
 *
 * Decisiones de seguridad:
 *  - El nombre en disco lo genera el servidor (uuid + extension derivada del
 *    MIME ya validado). El nombre que envia el usuario NO llega al sistema de
 *    archivos, lo que elimina el vector de path traversal.
 *  - `#rutaAbsoluta` verifica que la ruta resuelta quede dentro del directorio
 *    raiz antes de leer: una referencia manipulada en la base de datos no
 *    puede sacar la lectura del storage.
 *  - Los archivos se crean con permisos 0600 (solo el propietario).
 */
/*
 * Nota sobre `security/detect-non-literal-fs-filename`.
 *
 * ESLint advierte cada operacion de archivo cuya ruta no es un literal. En un
 * storage de documentos la ruta es dinamica POR DEFINICION, de modo que la
 * advertencia no puede eliminarse cambiando el codigo: es un falso positivo
 * conocido.
 *
 * El riesgo real que la regla busca (que una entrada del usuario dirija la
 * operacion a un archivo arbitrario) esta mitigado por dos controles
 * verificados en `tests/unit/infraestructura.test.js`:
 *   1. El nombre en disco lo genera el servidor (uuid + extension derivada del
 *      MIME ya validado); el nombre del usuario nunca llega al sistema de
 *      archivos.
 *   2. `#rutaAbsoluta` resuelve y confina toda ruta dentro del directorio
 *      raiz, y lanza si el resultado se escapa.
 *
 * Por eso la regla se desactiva en este archivo de forma explicita y
 * documentada, en vez de silenciarla globalmente en la configuracion.
 */
/* eslint-disable security/detect-non-literal-fs-filename */
export class StorageLocal {
  constructor(directorioRaiz) {
    this.raiz = path.resolve(directorioRaiz);
  }

  async inicializar() {
    await fs.mkdir(this.raiz, { recursive: true });
  }

  /**
   * @param {Buffer} contenido
   * @param {{examenId: number, mime: string}} meta
   * @returns {Promise<string>} referencia relativa a guardar en la BD
   */
  async guardar(contenido, meta) {
    const extension = EXTENSION_POR_MIME[meta.mime] ?? '.bin';
    const relativa = path.join(
      `examen-${Number(meta.examenId)}`,
      `${crypto.randomUUID()}${extension}`,
    );
    const absoluta = this.#rutaAbsoluta(relativa);
    await fs.mkdir(path.dirname(absoluta), { recursive: true });
    await fs.writeFile(absoluta, contenido, { mode: 0o600 });
    return relativa.split(path.sep).join('/');
  }

  /** @param {string} referencia valor de `documento.ruta_storage` */
  async leer(referencia) {
    return fs.readFile(this.#rutaAbsoluta(referencia));
  }

  async eliminar(referencia) {
    await fs.rm(this.#rutaAbsoluta(referencia), { force: true });
  }

  /**
   * Resuelve la referencia dentro del directorio raiz y rechaza cualquier
   * resultado que se escape de el.
   */
  #rutaAbsoluta(referencia) {
    const absoluta = path.resolve(this.raiz, referencia);
    const prefijo = this.raiz + path.sep;
    if (absoluta !== this.raiz && !absoluta.startsWith(prefijo)) {
      throw new Error(`Referencia de storage fuera del directorio permitido: ${referencia}`);
    }
    return absoluta;
  }
}

/* eslint-enable security/detect-non-literal-fs-filename */

const EXTENSION_POR_MIME = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Storage en memoria, para pruebas sin tocar el sistema de archivos. */
export class StorageMemoria {
  constructor() {
    this.archivos = new Map();
  }

  async inicializar() {
    return true;
  }

  async guardar(contenido, meta) {
    const referencia = `memoria/examen-${Number(meta.examenId)}/${crypto.randomUUID()}`;
    this.archivos.set(referencia, Buffer.from(contenido));
    return referencia;
  }

  async leer(referencia) {
    const contenido = this.archivos.get(referencia);
    if (!contenido) {
      throw new Error(`Archivo no encontrado en storage: ${referencia}`);
    }
    return contenido;
  }

  async eliminar(referencia) {
    this.archivos.delete(referencia);
  }
}
