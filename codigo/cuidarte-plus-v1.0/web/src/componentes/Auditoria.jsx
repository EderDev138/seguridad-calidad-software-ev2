import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { Aviso, RegionViva } from './Aviso.jsx';

/**
 * Consulta del registro de auditoria (RF-5.1).
 *
 * Solo visible para el rol ADMIN. El backend lo vuelve a exigir con 403, de
 * modo que ocultar la pestana es comodidad de interfaz y no el control
 * (NFR-SEG-4, RB-2).
 *
 * Nota de privacidad: el registro dice quien accedio a que dato clinico y
 * cuando, por lo que es en si mismo informacion sensible. Por eso no se
 * precarga el detalle completo ni se exporta desde esta pantalla sin una
 * accion explicita del administrador (minimizacion, Ley 19.628 / 21.719).
 */
const ETIQUETAS_ACCION = {
  LOGIN: 'Inicio de sesion',
  LOGIN_FALLIDO: 'Intento de acceso fallido',
  LOGOUT: 'Cierre de sesion',
  REGISTRO_USUARIO: 'Autorregistro de usuario',
  CREAR_USUARIO: 'Creacion de usuario',
  EDITAR_USUARIO: 'Edicion de usuario',
  ELIMINAR_USUARIO: 'Baja de usuario',
  CREAR_PACIENTE: 'Creacion de paciente',
  EDITAR_PACIENTE: 'Edicion de paciente',
  ELIMINAR_PACIENTE: 'Baja de paciente',
  CREAR_EXAMEN: 'Creacion de examen',
  EDITAR_EXAMEN: 'Edicion de examen',
  ELIMINAR_EXAMEN: 'Baja de examen',
  SUBIR_DOCUMENTO: 'Subida de documento',
  DESCARGAR_DOCUMENTO: 'Descarga de documento',
  ELIMINAR_DOCUMENTO: 'Baja de documento',
};

function formatearInstante(valor) {
  if (!valor) {
    return 'Sin fecha';
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toLocaleString('es-CL');
}

export function Auditoria({ sesion }) {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  // `cargando` nace en true; el efecto solo lo baja al resolverse la promesa
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let vigente = true;
    api
      .listarAuditoria(sesion.token, 50)
      .then((datos) => {
        if (vigente) {
          setRegistros(datos);
          setError(null);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          setError(
            fallo instanceof ErrorApi ? fallo.mensaje : 'No fue posible cargar la auditoria',
          );
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false);
        }
      });
    return () => {
      vigente = false;
    };
  }, [sesion.token]);

  return (
    <section className="panel" aria-labelledby="titulo-auditoria">
      <h2 className="panel__titulo" id="titulo-auditoria">
        Registro de auditoria
      </h2>
      <p className="panel__ayuda">
        Ultimas 50 acciones criticas registradas. El registro es inmutable: no se puede editar ni
        eliminar desde la aplicacion.
      </p>

      <Aviso tipo="error" mensaje={error} />
      <RegionViva
        texto={cargando ? 'Cargando registro de auditoria...' : `${registros.length} registros`}
      />

      {!cargando && registros.length === 0 && (
        <p className="vacio">Todavia no hay acciones registradas.</p>
      )}

      {registros.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <caption>Acciones criticas del sistema, de la mas reciente a la mas antigua.</caption>
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Accion</th>
                <th scope="col">Usuario</th>
                <th scope="col">Entidad</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  <td>{formatearInstante(registro.creadoEn)}</td>
                  <td>{ETIQUETAS_ACCION[registro.accion] ?? registro.accion}</td>
                  <td>{registro.usuarioId ?? 'Anonimo'}</td>
                  <td>
                    {registro.entidad
                      ? `${registro.entidad}${registro.entidadId ? ` #${registro.entidadId}` : ''}`
                      : 'No aplica'}
                  </td>
                  {/* Texto plano: React escapa el contenido del detalle, que
                      proviene de datos del usuario. */}
                  <td>{registro.detalle ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
