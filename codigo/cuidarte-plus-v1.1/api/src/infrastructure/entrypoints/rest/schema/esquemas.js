import { z } from 'zod';
import { ROLES_VALIDOS } from '../../../../domain/model/roles.js';
import { ESTADOS_EXAMEN } from '../../../../domain/model/Examen.js';

/**
 * Esquemas de validacion de las peticiones (ERS §3.1.2, NFR-SEG-5).
 *
 * Todos usan `.strict()`: un campo no declarado hace fallar la peticion en vez
 * de llegar silenciosamente al dominio. Eso es lo que cierra el mass
 * assignment (por ejemplo, intentar fijar `rol` al autorregistrarse).
 *
 * Los textos libres tienen longitud maxima acotada: sin tope, un campo de texto
 * es un vector de denegacion de servicio por consumo de memoria.
 */

const texto = (maximo) => z.string().trim().min(1).max(maximo);

/** El RUT se valida con detalle en el dominio; aqui solo la forma general. */
const rut = z
  .string()
  .trim()
  .min(9)
  .max(12)
  .regex(/^[\d.]+-?[\dkK]$/, 'Formato de RUT invalido');

const password = z.string().min(12).max(128);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD');

// ---------------------------------------------------------------------------
// Autenticacion (RF-1, RF-2.1)
// ---------------------------------------------------------------------------

export const esquemaLogin = z
  .object({
    nombreUsuario: texto(60),
    password: z.string().min(1).max(128),
  })
  .strict();

/**
 * Autorregistro (RF-2.1).
 *
 * Nota de seguridad: NO hay campo `rol`. El rol lo fija el servidor en
 * PACIENTE; `.strict()` garantiza que enviarlo devuelva 400 en vez de
 * escalar privilegios.
 */
export const esquemaRegistro = z
  .object({
    nombreUsuario: texto(60).regex(
      /^[a-zA-Z0-9._-]+$/,
      'Solo se permiten letras, numeros, punto, guion y guion bajo',
    ),
    email: z.string().email().max(160),
    password,
  })
  .strict();

export const esquemaRefresh = z.object({ refreshToken: z.string().min(10) }).strict();

// ---------------------------------------------------------------------------
// Usuarios (RF-2.5 a RF-2.7)
// ---------------------------------------------------------------------------

export const esquemaCrearUsuario = z
  .object({
    nombreUsuario: texto(60),
    email: z.string().email().max(160),
    password,
    rol: z.enum(ROLES_VALIDOS),
  })
  .strict();

export const esquemaActualizarUsuario = z
  .object({
    email: z.string().email().max(160).optional(),
    password: password.optional(),
    rol: z.enum(ROLES_VALIDOS).optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe indicar al menos un campo a modificar',
  });

// ---------------------------------------------------------------------------
// Pacientes (RF-2.2 a RF-2.4)
// ---------------------------------------------------------------------------

export const esquemaCrearPaciente = z
  .object({
    rut,
    nombres: texto(120),
    apellidos: texto(120),
    fechaNacimiento: fechaIso.optional(),
    telefono: z.string().trim().max(40).optional(),
    email: z.string().email().max(160).optional(),
    usuarioId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const esquemaActualizarPaciente = z
  .object({
    rut: rut.optional(),
    nombres: texto(120).optional(),
    apellidos: texto(120).optional(),
    fechaNacimiento: fechaIso.optional(),
    telefono: z.string().trim().max(40).optional(),
    email: z.string().email().max(160).optional(),
    usuarioId: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe indicar al menos un campo a modificar',
  });

// ---------------------------------------------------------------------------
// Examenes (RF-3)
// ---------------------------------------------------------------------------

export const esquemaCrearExamen = z
  .object({
    pacienteId: z.coerce.number().int().positive(),
    tipo: texto(120),
    descripcion: z.string().trim().max(2000).optional(),
    fechaExamen: fechaIso.optional(),
    estado: z.enum(Object.values(ESTADOS_EXAMEN)).optional(),
  })
  .strict();

export const esquemaActualizarExamen = z
  .object({
    tipo: texto(120).optional(),
    descripcion: z.string().trim().max(2000).optional(),
    fechaExamen: fechaIso.optional(),
    estado: z.enum(Object.values(ESTADOS_EXAMEN)).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe indicar al menos un campo a modificar',
  });

// ---------------------------------------------------------------------------
// Parametros de ruta y de consulta
// ---------------------------------------------------------------------------

export const esquemaIdRuta = z.object({ id: z.coerce.number().int().positive() });

export const esquemaPacienteIdRuta = z.object({
  pacienteId: z.coerce.number().int().positive(),
});

export const esquemaExamenIdRuta = z.object({
  examenId: z.coerce.number().int().positive(),
});

export const esquemaFiltroAuditoria = z
  .object({
    accion: z.string().trim().max(40).optional(),
    usuarioId: z.coerce.number().int().positive().optional(),
    entidad: z.string().trim().max(40).optional(),
    limite: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

/**
 * Termino de busqueda de pacientes.
 *
 * Se acota la longitud y se rechazan los caracteres de control. El valor viaja
 * de todos modos como parametro posicional a PostgreSQL, de modo que no es un
 * vector de inyeccion; el limite es una medida de robustez.
 */
export const esquemaBusqueda = z
  .object({
    q: z.string().trim().max(80).optional(),
  })
  .strict();
