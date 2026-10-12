import { Documento, firmaCoincide } from '../../domain/model/Documento.js';
import { ROLES, ACCIONES_AUDITABLES } from '../../domain/model/roles.js';
import { NoEncontrado, NoAutorizado, DatosInvalidos } from '../../domain/error/errors.js';

/**
 * Gestion de documentos clinicos (ERS RF-4.2, RF-4.3, RF-4.4).
 *
 * Reglas de acceso:
 *  - MEDICO / ADMIN: adjuntan y eliminan documentos (RF-4.3, RB-2, RB-3).
 *  - PACIENTE: descarga los documentos de SUS propios examenes (RF-4.2, RB-1).
 *
 * El binario se guarda en el storage interno y la base de datos solo conserva
 * la referencia (RF-4.4). Cada descarga queda auditada, porque acceder a un
 * documento clinico es tratamiento de un dato sensible (Ley 19.628 / 21.719).
 */
export class DocumentoUseCase {
  constructor({ documentoGateway, examenUseCase, storage, auditoriaGateway }) {
    this.documentos = documentoGateway;
    this.examenUseCase = examenUseCase;
    this.storage = storage;
    this.auditoria = auditoriaGateway;
  }

  static #puedeEscribir(actor) {
    return actor && (actor.rol === ROLES.ADMIN || actor.rol === ROLES.MEDICO);
  }

  /** Documentos de un examen; hereda la autorizacion del examen. */
  async listarPorExamen(examenId, actor) {
    await this.examenUseCase.obtener(examenId, actor);
    return this.documentos.listarPorExamen(examenId);
  }

  /**
   * RF-4.3 / RF-4.4 — adjunta un documento a un examen.
   *
   * Se valida el tipo declarado contra la lista blanca Y la firma binaria del
   * contenido. Confiar solo en el `Content-Type` que envia el cliente permite
   * subir un archivo ejecutable renombrado (NFR-SEG-12, OWASP A04).
   */
  async adjuntar({ examenId, nombreArchivo, mime, contenido }, actor, contexto = {}) {
    if (!DocumentoUseCase.#puedeEscribir(actor)) {
      throw new NoAutorizado('Solo un medico o un administrador puede adjuntar documentos');
    }
    await this.examenUseCase.obtener(examenId, actor);

    if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
      throw new DatosInvalidos('El documento esta vacio');
    }
    if (!firmaCoincide(contenido, mime)) {
      throw new DatosInvalidos(
        `El contenido del archivo no corresponde al tipo declarado (${mime})`,
      );
    }

    const rutaStorage = await this.storage.guardar(contenido, { examenId, nombreArchivo, mime });

    const documento = new Documento({
      examenId,
      // El nombre original es dato del usuario: se guarda saneado para que no
      // pueda usarse como vector de path traversal ni de XSS al mostrarlo.
      nombreArchivo: DocumentoUseCase.#sanearNombre(nombreArchivo),
      mime,
      tamanoBytes: contenido.length,
      rutaStorage,
      subidoPor: actor.id,
    }).validar();

    const creado = await this.documentos.crear(documento);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.SUBIR_DOCUMENTO,
      entidad: 'documento',
      entidadId: creado.id,
      detalle: `examenId=${examenId} mime=${mime} bytes=${contenido.length}`,
      ip: contexto.ip ?? null,
    });
    return creado;
  }

  /** RF-4.2 — descarga del documento, auditada y con verificacion de acceso. */
  async descargar(id, actor, contexto = {}) {
    const documento = await this.documentos.obtenerPorId(id);
    if (!documento) {
      throw new NoEncontrado('Documento', id);
    }
    // La autorizacion sube por la cadena documento -> examen -> paciente, de
    // modo que un paciente solo descarga lo propio (RB-1).
    await this.examenUseCase.obtener(documento.examenId, actor);

    const contenido = await this.storage.leer(documento.rutaStorage);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.DESCARGAR_DOCUMENTO,
      entidad: 'documento',
      entidadId: id,
      ip: contexto.ip ?? null,
    });
    return { documento, contenido };
  }

  /** RF-3.3 — eliminacion logica del documento asociado a un examen. */
  async eliminar(id, actor, contexto = {}) {
    if (!DocumentoUseCase.#puedeEscribir(actor)) {
      throw new NoAutorizado('Solo un medico o un administrador puede eliminar documentos');
    }
    const documento = await this.documentos.obtenerPorId(id);
    if (!documento) {
      throw new NoEncontrado('Documento', id);
    }
    await this.examenUseCase.obtener(documento.examenId, actor);

    await this.documentos.eliminar(id);
    await this.auditoria.registrar({
      usuarioId: actor.id,
      accion: ACCIONES_AUDITABLES.ELIMINAR_DOCUMENTO,
      entidad: 'documento',
      entidadId: id,
      ip: contexto.ip ?? null,
    });
    return { eliminado: true, logica: true };
  }

  /**
   * Deja solo caracteres seguros en el nombre del archivo.
   *
   * El enfoque es de LISTA BLANCA y el orden de los pasos importa:
   *  1. Se descarta todo lo que no sea letra, numero, punto, guion, guion bajo
   *     o espacio. Esto elimina de raiz los separadores de ruta de ambos
   *     sistemas operativos y cualquier caracter de control.
   *  2. Recien entonces se colapsan las secuencias de puntos, de modo que no
   *     pueda quedar un ".." reconstruido tras eliminar las barras.
   *
   * Resultado: el nombre que se almacena no puede contener un componente de
   * ruta (anti path traversal) ni caracteres que un navegador interprete.
   */
  static #sanearNombre(nombre) {
    const base = String(nombre ?? 'documento')
      .replace(/[^\w.\- ]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^[.\s]+/, '')
      .trim();
    return base.length > 0 ? base.slice(0, 180) : 'documento';
  }
}
