/**
 * Cliente de la API REST de Cuidarte+.
 *
 * Decisiones de seguridad del lado del cliente:
 *  - El token se guarda en `sessionStorage` y no en `localStorage`: desaparece
 *    al cerrar la pestana, lo que acota la ventana de uso en un equipo
 *    compartido (habitual en un centro de salud).
 *  - El token NUNCA viaja en la URL, solo en la cabecera `Authorization`: una
 *    URL queda en el historial, en los logs del proxy y en el `Referer`.
 *  - Ante un 401 se limpia la sesion local, para que la interfaz no quede
 *    mostrando datos con una sesion que el servidor ya revoco.
 *
 * Importante: estas medidas complementan, no reemplazan, los controles del
 * backend. La autorizacion real la aplica el servidor (NFR-SEG-4).
 */

const CLAVE_SESION = 'cuidarte.sesion';

/** Error de API con el status y el detalle que devolvio el servidor. */
export class ErrorApi extends Error {
  constructor(mensaje, status, detalle) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.detalle = detalle;
  }
}

export function leerSesion() {
  try {
    const guardado = sessionStorage.getItem(CLAVE_SESION);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    // Almacenamiento bloqueado o dato corrupto: se trata como "sin sesion".
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Si el navegador no permite almacenar, la sesion vive solo en memoria.
  }
}

export function borrarSesion() {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // Nada que hacer: la sesion en memoria se descarta igual.
  }
}

/** Arma las cabeceras de la peticion segun el tipo de carga. */
function armarCabeceras({ token, cuerpo }) {
  const cabeceras = {};
  if (token) {
    // El token viaja en la cabecera y nunca en la URL: una URL queda en el
    // historial, en los logs del proxy y en el `Referer`.
    cabeceras.Authorization = `Bearer ${token}`;
  }
  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }
  return cabeceras;
}

/**
 * Interpreta la respuesta: JSON cuando el servidor lo declara, binario para
 * las descargas de documentos.
 */
async function interpretar(respuesta) {
  if (respuesta.status === 204) {
    return null;
  }

  const tipo = respuesta.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    if (!respuesta.ok) {
      throw new ErrorApi('El servidor no respondio correctamente', respuesta.status);
    }
    return respuesta.blob();
  }

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new ErrorApi(
      datos.mensaje ?? 'Ocurrio un error al comunicarse con el servidor',
      respuesta.status,
      datos.detalle,
    );
  }
  return datos;
}

/**
 * Realiza una peticion a la API.
 *
 * @param {string} ruta ruta relativa bajo /api/v1
 * @param {{metodo?: string, cuerpo?: object, token?: string, archivo?: FormData}} opciones
 */
async function peticion(ruta, { metodo = 'GET', cuerpo, token, archivo } = {}) {
  const respuesta = await fetch(`/api/v1${ruta}`, {
    method: metodo,
    headers: armarCabeceras({ token, cuerpo }),
    body: archivo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
  });

  // Si el servidor ya no reconoce la sesion, se limpia la copia local para que
  // la interfaz no siga mostrando datos con una sesion revocada (RF-1.2).
  if (respuesta.status === 401) {
    borrarSesion();
  }

  return interpretar(respuesta);
}

export const api = {
  // --- Autenticacion (RF-1, RF-2.1) --------------------------------------
  login: (nombreUsuario, password) =>
    peticion('/auth/login', { metodo: 'POST', cuerpo: { nombreUsuario, password } }),

  registro: (nombreUsuario, email, password) =>
    peticion('/auth/registro', { metodo: 'POST', cuerpo: { nombreUsuario, email, password } }),

  logout: (token) => peticion('/auth/logout', { metodo: 'POST', token }),

  yo: (token) => peticion('/auth/yo', { token }),

  // --- Pacientes (RF-2.2 a RF-2.4) ---------------------------------------
  listarPacientes: (token) => peticion('/pacientes', { token }),

  obtenerPaciente: (token, id) => peticion(`/pacientes/${id}`, { token }),

  crearPaciente: (token, datos) => peticion('/pacientes', { metodo: 'POST', cuerpo: datos, token }),

  // --- Examenes (RF-3, RF-4.1) -------------------------------------------
  listarExamenes: (token, pacienteId) => peticion(`/pacientes/${pacienteId}/examenes`, { token }),

  crearExamen: (token, datos) => peticion('/examenes', { metodo: 'POST', cuerpo: datos, token }),

  eliminarExamen: (token, id) => peticion(`/examenes/${id}`, { metodo: 'DELETE', token }),

  // --- Documentos (RF-4.2 a RF-4.4) --------------------------------------
  listarDocumentos: (token, examenId) => peticion(`/examenes/${examenId}/documentos`, { token }),

  adjuntarDocumento: (token, examenId, archivo) => {
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    return peticion(`/examenes/${examenId}/documentos`, {
      metodo: 'POST',
      token,
      archivo: formulario,
    });
  },

  descargarDocumento: (token, id) => peticion(`/documentos/${id}/descarga`, { token }),

  // --- Auditoria (RF-5) ---------------------------------------------------
  listarAuditoria: (token, limite = 50) => peticion(`/auditoria?limite=${limite}`, { token }),

  // --- Salud (NFR-DIS-3) --------------------------------------------------
  salud: () => peticion('/salud'),
};
