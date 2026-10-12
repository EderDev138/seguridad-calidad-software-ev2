import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { Aviso, RegionViva } from './Aviso.jsx';

/**
 * Listado y busqueda de pacientes (RF-2.4, RF-4.1).
 *
 * El filtro se aplica en el cliente sobre los datos que el servidor ya decidio
 * entregar: un paciente recibe unicamente su propia ficha, de modo que el
 * buscador no puede usarse para descubrir pacientes ajenos (RB-1).
 *
 * El flujo es escalonado (NFR-USAB-4): desde aqui se selecciona un paciente y
 * recien entonces se accede a sus examenes.
 */
export function Pacientes({ sesion, onSeleccionarPaciente }) {
  const [pacientes, setPacientes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  /*
   * El efecto no pone `cargando` en true: ese es su valor inicial y cambiarlo
   * de forma sincronica dentro del efecto encadena renders innecesarios
   * (react-hooks/set-state-in-effect). El estado solo se actualiza en los
   * callbacks de la promesa, que es el patron recomendado por React.
   */
  useEffect(() => {
    let vigente = true;
    api
      .listarPacientes(sesion.token)
      .then((datos) => {
        if (vigente) {
          setPacientes(datos);
          setError(null);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          setError(
            fallo instanceof ErrorApi ? fallo.mensaje : 'No fue posible cargar los pacientes',
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

  const termino = filtro.trim().toLowerCase();
  const visibles = termino
    ? pacientes.filter((paciente) =>
        `${paciente.nombres} ${paciente.apellidos} ${paciente.rut}`.toLowerCase().includes(termino),
      )
    : pacientes;

  return (
    <section className="panel" aria-labelledby="titulo-pacientes">
      <h2 className="panel__titulo" id="titulo-pacientes">
        Pacientes
      </h2>
      <p className="panel__ayuda">
        Seleccione un paciente para ver sus examenes medicos y sus documentos asociados.
      </p>

      <Aviso tipo="error" mensaje={error} />

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="busqueda-paciente">
          Buscar por nombre o RUT
        </label>
        <input
          className="campo__entrada"
          id="busqueda-paciente"
          type="search"
          value={filtro}
          onChange={(evento) => setFiltro(evento.target.value)}
          aria-describedby="resultado-busqueda"
        />
        {/*
          El resultado se anuncia en una region viva. Sin esto, quien usa un
          lector de pantalla escribe en el buscador y no recibe ninguna senal
          de cuantos resultados quedaron (WCAG 4.1.3).
        */}
        <span id="resultado-busqueda">
          <RegionViva
            texto={
              cargando
                ? 'Cargando pacientes...'
                : `${visibles.length} paciente${visibles.length === 1 ? '' : 's'} en el listado`
            }
          />
        </span>
      </div>

      {!cargando && visibles.length === 0 && (
        <p className="vacio">
          {pacientes.length === 0
            ? 'Todavia no hay pacientes registrados.'
            : 'Ningun paciente coincide con la busqueda.'}
        </p>
      )}

      {visibles.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <caption>
              Listado de pacientes. Use el boton &quot;Ver examenes&quot; de cada fila para abrir su
              ficha clinica.
            </caption>
            <thead>
              <tr>
                <th scope="col">RUT</th>
                <th scope="col">Nombre</th>
                <th scope="col">Telefono</th>
                <th scope="col">Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((paciente) => (
                <tr key={paciente.id}>
                  <td>{paciente.rut}</td>
                  <td>{`${paciente.nombres} ${paciente.apellidos}`}</td>
                  <td>{paciente.telefono ?? 'No registrado'}</td>
                  <td>
                    <button
                      className="boton boton--secundario"
                      type="button"
                      onClick={() => onSeleccionarPaciente(paciente)}
                    >
                      {/* El nombre va en el texto accesible del boton: "Ver
                          examenes" repetido 20 veces no le dice nada a quien
                          navega saltando de boton en boton (WCAG 2.4.6). */}
                      Ver examenes
                      <span className="visualmente-oculto">
                        {` de ${paciente.nombres} ${paciente.apellidos}`}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
