import multer from 'multer';
import { TAMANO_MAXIMO_BYTES, MIME_PERMITIDOS } from '../../../../domain/model/Documento.js';
import { DatosInvalidos } from '../../../../domain/error/errors.js';

/**
 * Utilidades compartidas por los routers de cada recurso.
 */

/**
 * Envuelve un handler asincrono para que sus rechazos lleguen al errorHandler.
 *
 * Sin esto, una promesa rechazada dentro de un handler quedaria sin atender y
 * la peticion se colgaria hasta el timeout del cliente.
 */
export const asinc = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/**
 * Recepcion de archivos en memoria con tope de tamano (NFR-SEG-12).
 *
 * El filtro rechaza por lista blanca de tipo MIME declarado; el contenido
 * binario se verifica despues en el caso de uso contra la firma del archivo,
 * porque el `Content-Type` lo elige el cliente y no es confiable.
 */
export function crearSubidor() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 1 },
    fileFilter(_req, file, callback) {
      if (!Object.hasOwn(MIME_PERMITIDOS, file.mimetype)) {
        return callback(
          new DatosInvalidos(`Tipo de archivo no permitido: ${file.mimetype}`, {
            permitidos: Object.keys(MIME_PERMITIDOS),
          }),
        );
      }
      return callback(null, true);
    },
  });
}
