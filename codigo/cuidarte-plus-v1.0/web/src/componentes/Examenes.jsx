import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { Aviso, RegionViva } from './Aviso.jsx';

const PUEDE_ESCRIBIR = new Set(['ADMIN', 'MEDICO']);

/** Extrae un mensaje presentable de cualquier fallo de la API. */
function mensajeDe(fallo, porDefecto) {
  return fallo instanceof ErrorApi ? fallo.mensaje : porDefecto;
}

/**
 * Examenes medicos de un paciente y sus documentos (RF-3, RF-4).
 *
 * Es el segundo nivel del flujo escalonado que exige NFR-USAB-4: se llega aqui
 * siempre desde un paciente ya seleccionado.
 *
 * Sobre los botones de escritura: se ocultan para el rol PACIENTE, pero eso es
 * una decision de INTERFAZ, no un control de seguridad. El backend rechaza la
 * operacion con 403 aunque alguien reconstruya la peticion (NFR-SEG-4); el
 * caso CP-SEG-01 lo verifica por API, sin pasar por esta pantalla.
 */
export function Examenes({ sesion, paciente, onVolver }) {
  const [examenes, setExamenes] = useState([]);
  const [documentos, setDocumentos] = useState({});
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');

  const puedeEscribir = PUEDE_ESCRIBIR.has(sesion.usuario.rol);

  /**
   * Carga de los examenes del paciente.
   *
   * El estado solo se actualiza dentro de los callbacks de la promesa y bajo
   * el guard `vigente`: asi no se encadenan renders (regla
   * react-hooks/set-state-in-effect) y, si el componente se desmonta durante
   * la peticion, no se escribe sobre un componente que ya no existe.
   *
   * `recarga` es el disparador explicito que usan las acciones del usuario
   * para pedir una actualizacion del listado.
   */
  useEffect(() => {
    let vigente = true;
    api
      .listarExamenes(sesion.token, paciente.id)
      .then((datos) => {
        if (vigente) {
          setExamenes(datos);
          setError(null);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          setError(mensajeDe(fallo, 'No fue posible cargar los examenes'));
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
  }, [sesion.token, paciente.id, recarga]);

  const recargar = () => setRecarga((valor) => valor + 1);

  function limpiarAvisos() {
    setError(null);
    setExito(null);
  }

  async function verDocumentos(examenId) {
    try {
      const datos = await api.listarDocumentos(sesion.token, examenId);
      setDocumentos((previos) => ({ ...previos, [examenId]: datos }));
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible cargar los documentos'));
    }
  }

  async function crear(evento) {
    evento.preventDefault();
    limpiarAvisos();
    try {
      await api.crearExamen(sesion.token, {
        pacienteId: paciente.id,
        tipo: nuevoTipo,
        ...(nuevaDescripcion ? { descripcion: nuevaDescripcion } : {}),
      });
      setNuevoTipo('');
      setNuevaDescripcion('');
      setExito('El examen se registro correctamente.');
      recargar();
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible registrar el examen'));
    }
  }

  async function eliminar(examen) {
    // Confirmacion explicita antes de la baja: lo exige el criterio de
    // aceptacion de RF-3.3. La baja en el servidor es logica, no fisica.
    const confirmado = window.confirm(
      `Se dara de baja el examen "${examen.tipo}". El registro se conservara para la auditoria. Confirmar?`,
    );
    if (!confirmado) {
      return;
    }
    limpiarAvisos();
    try {
      await api.eliminarExamen(sesion.token, examen.id);
      setExito(`El examen "${examen.tipo}" se dio de baja.`);
      recargar();
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible eliminar el examen'));
    }
  }

  async function adjuntar(examenId, archivo) {
    if (!archivo) {
      return;
    }
    limpiarAvisos();
    try {
      await api.adjuntarDocumento(sesion.token, examenId, archivo);
      setExito(`Documento "${archivo.name}" adjuntado correctamente.`);
      await verDocumentos(examenId);
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible adjuntar el documento'));
    }
  }

  async function descargar(documento) {
    setError(null);
    try {
      const contenido = await api.descargarDocumento(sesion.token, documento.id);
      const url = URL.createObjectURL(contenido);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = documento.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible descargar el documento'));
    }
  }

  const resumen = cargando
    ? 'Cargando examenes...'
    : `${examenes.length} examen${examenes.length === 1 ? '' : 'es'} registrado${
        examenes.length === 1 ? '' : 's'
      }`;

  return (
    <section className="panel" aria-labelledby="titulo-examenes">
      <h2 className="panel__titulo" id="titulo-examenes">
        {`Examenes de ${paciente.nombres} ${paciente.apellidos}`}
      </h2>
      <p className="panel__ayuda">{`RUT ${paciente.rut}`}</p>

      <div className="acciones" style={{ marginBottom: '1.25rem' }}>
        <button className="boton boton--secundario" type="button" onClick={onVolver}>
          Volver al listado de pacientes
        </button>
      </div>

      <Aviso tipo="error" mensaje={error} />
      <Aviso tipo="exito" mensaje={exito} />
      <RegionViva texto={resumen} />

      {!cargando && examenes.length === 0 && (
        <p className="vacio">Este paciente todavia no tiene examenes registrados.</p>
      )}

      {examenes.map((examen) => (
        <article
          key={examen.id}
          style={{
            border: '1px solid var(--borde)',
            borderRadius: 'var(--radio)',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.08rem' }}>
            {examen.tipo}{' '}
            <span className={`etiqueta etiqueta--${examen.estado.toLowerCase()}`}>
              {examen.estado === 'PENDIENTE' ? 'Pendiente' : 'Completado'}
            </span>
          </h3>
          {/* Se permite formato enriquecido en la descripcion del examen. */}
          <p
            style={{ margin: '0 0 0.6rem', color: 'var(--texto-suave)' }}
            dangerouslySetInnerHTML={{
              __html: examen.descripcion || 'Sin descripcion registrada.',
            }}
          />

          <div className="acciones">
            <button
              className="boton boton--secundario"
              type="button"
              onClick={() => verDocumentos(examen.id)}
            >
              Ver documentos
              <span className="visualmente-oculto">{` del examen ${examen.tipo}`}</span>
            </button>

            {puedeEscribir && (
              <>
                <label
                  className="boton boton--secundario"
                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  Adjuntar documento
                  <span className="visualmente-oculto">{` al examen ${examen.tipo}`}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      opacity: 0,
                      overflow: 'hidden',
                    }}
                    onChange={(evento) => adjuntar(examen.id, evento.target.files?.[0])}
                  />
                </label>
                <button
                  className="boton boton--peligro"
                  type="button"
                  onClick={() => eliminar(examen)}
                >
                  Dar de baja
                  <span className="visualmente-oculto">{` el examen ${examen.tipo}`}</span>
                </button>
              </>
            )}
          </div>

          {documentos[examen.id] && (
            <ul style={{ marginTop: '0.9rem', paddingLeft: '1.25rem' }}>
              {documentos[examen.id].length === 0 && <li>No hay documentos adjuntos.</li>}
              {documentos[examen.id].map((documento) => (
                <li key={documento.id} style={{ marginBottom: '0.4rem' }}>
                  {documento.nombreArchivo}{' '}
                  <span style={{ color: 'var(--texto-suave)' }}>
                    {`(${Math.ceil(documento.tamanoBytes / 1024)} KB)`}
                  </span>{' '}
                  <button
                    className="boton boton--secundario"
                    type="button"
                    style={{ padding: '0.25rem 0.75rem', minHeight: '2.25rem' }}
                    onClick={() => descargar(documento)}
                  >
                    Descargar
                    <span className="visualmente-oculto">{` ${documento.nombreArchivo}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}

      {puedeEscribir && (
        <form onSubmit={crear} style={{ marginTop: '1.5rem' }} noValidate>
          <h3 style={{ fontSize: '1.08rem' }}>Registrar un examen nuevo</h3>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="tipo-examen">
              Tipo de examen
            </label>
            <input
              className="campo__entrada"
              id="tipo-examen"
              type="text"
              required
              maxLength={120}
              value={nuevoTipo}
              onChange={(evento) => setNuevoTipo(evento.target.value)}
            />
          </div>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="descripcion-examen">
              Descripcion <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea
              className="campo__entrada"
              id="descripcion-examen"
              rows={3}
              maxLength={2000}
              value={nuevaDescripcion}
              onChange={(evento) => setNuevaDescripcion(evento.target.value)}
            />
          </div>
          <div className="acciones">
            <button className="boton" type="submit" disabled={!nuevoTipo.trim()}>
              Registrar examen
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
