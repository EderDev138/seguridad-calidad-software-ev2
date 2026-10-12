import { DatosInvalidos } from '../error/errors.js';

/**
 * Tipos MIME admitidos para los documentos clinicos (ERS RF-4.3).
 *
 * La lista es una LISTA BLANCA: todo lo que no figure aqui se rechaza.
 * Validar por lista blanca de tipo declarado y de firma binaria, y no por
 * extension del nombre de archivo, es lo que evita subir un ejecutable
 * renombrado a `.pdf` (NFR-SEG-12, OWASP A04).
 */
export const MIME_PERMITIDOS = Object.freeze({
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
});

/** Tamano maximo por documento: 10 MB (NFR-SEG-12). */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

/**
 * Firmas binarias (magic numbers) de los formatos admitidos, en hexadecimal.
 * Se comparan contra los primeros bytes del archivo recibido para confirmar
 * que el contenido corresponde al tipo declarado.
 */
export const FIRMAS_BINARIAS = Object.freeze({
  'application/pdf': ['25504446'],
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'application/msword': ['d0cf11e0'],
  'application/vnd.ms-powerpoint': ['d0cf11e0'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['504b0304'],
});

/**
 * Verifica que los primeros bytes del archivo coincidan con alguna firma
 * conocida del tipo MIME declarado.
 *
 * @param {Buffer} buffer contenido recibido
 * @param {string} mime tipo declarado por el cliente
 * @returns {boolean}
 */
export function firmaCoincide(buffer, mime) {
  const firmas = FIRMAS_BINARIAS[mime];
  if (!firmas) {
    return false;
  }
  const cabecera = buffer.subarray(0, 8).toString('hex');
  return firmas.some((firma) => cabecera.startsWith(firma));
}

/**
 * Documento clinico adjunto a un examen (ERS RF-4.3, RF-4.4).
 *
 * El archivo vive en el storage interno y la base de datos guarda solo su
 * referencia (`rutaStorage`); nunca el binario.
 */
export class Documento {
  constructor({
    id = null,
    examenId,
    nombreArchivo,
    mime,
    tamanoBytes,
    rutaStorage,
    subidoPor = null,
    creadoEn = null,
    eliminadoEn = null,
  }) {
    this.id = id;
    this.examenId = examenId;
    this.nombreArchivo = nombreArchivo;
    this.mime = mime;
    this.tamanoBytes = tamanoBytes;
    this.rutaStorage = rutaStorage;
    this.subidoPor = subidoPor;
    this.creadoEn = creadoEn;
    this.eliminadoEn = eliminadoEn;
  }

  validar() {
    if (!this.examenId) {
      throw new DatosInvalidos('El documento debe estar asociado a un examen');
    }
    if (!Object.hasOwn(MIME_PERMITIDOS, this.mime)) {
      const permitidos = Object.keys(MIME_PERMITIDOS).join(', ');
      throw new DatosInvalidos(
        `Tipo de archivo no permitido: ${this.mime}. Permitidos: ${permitidos}`,
      );
    }
    if (!Number.isInteger(this.tamanoBytes) || this.tamanoBytes <= 0) {
      throw new DatosInvalidos('El tamano del documento es invalido');
    }
    if (this.tamanoBytes > TAMANO_MAXIMO_BYTES) {
      const maximoMb = TAMANO_MAXIMO_BYTES / (1024 * 1024);
      throw new DatosInvalidos(`El documento excede el tamano maximo de ${maximoMb} MB`);
    }
    return this;
  }
}
