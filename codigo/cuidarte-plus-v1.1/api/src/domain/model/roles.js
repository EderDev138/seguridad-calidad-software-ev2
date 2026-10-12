/**
 * Roles del sistema (ERS Caso B §2.3).
 *
 * El rol determina los permisos que el backend aplica en cada operacion
 * (NFR-SEG-4) y materializa las reglas de negocio RB-1, RB-2 y RB-3.
 */
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MEDICO: 'MEDICO',
  PACIENTE: 'PACIENTE',
});

/** Rol asignado por defecto al autorregistro (RF-2.1). */
export const ROL_POR_DEFECTO = ROLES.PACIENTE;

export const ROLES_VALIDOS = Object.freeze(Object.values(ROLES));

/**
 * Acciones criticas que deben quedar registradas en auditoria (RF-5.1).
 */
export const ACCIONES_AUDITABLES = Object.freeze({
  LOGIN: 'LOGIN',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  LOGOUT: 'LOGOUT',
  REGISTRO_USUARIO: 'REGISTRO_USUARIO',
  CREAR_USUARIO: 'CREAR_USUARIO',
  EDITAR_USUARIO: 'EDITAR_USUARIO',
  ELIMINAR_USUARIO: 'ELIMINAR_USUARIO',
  CREAR_PACIENTE: 'CREAR_PACIENTE',
  EDITAR_PACIENTE: 'EDITAR_PACIENTE',
  ELIMINAR_PACIENTE: 'ELIMINAR_PACIENTE',
  CREAR_EXAMEN: 'CREAR_EXAMEN',
  EDITAR_EXAMEN: 'EDITAR_EXAMEN',
  ELIMINAR_EXAMEN: 'ELIMINAR_EXAMEN',
  SUBIR_DOCUMENTO: 'SUBIR_DOCUMENTO',
  DESCARGAR_DOCUMENTO: 'DESCARGAR_DOCUMENTO',
  ELIMINAR_DOCUMENTO: 'ELIMINAR_DOCUMENTO',
});
