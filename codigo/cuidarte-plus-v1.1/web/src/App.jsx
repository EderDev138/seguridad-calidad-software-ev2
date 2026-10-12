import { useEffect, useState } from 'react';
import { api, leerSesion, guardarSesion, borrarSesion } from './api.js';
import { Acceso } from './componentes/Acceso.jsx';
import { Pacientes } from './componentes/Pacientes.jsx';
import { Examenes } from './componentes/Examenes.jsx';
import { Auditoria } from './componentes/Auditoria.jsx';

const NOMBRE_ROL = {
  ADMIN: 'Administrador',
  MEDICO: 'Medico',
  PACIENTE: 'Paciente',
};

/**
 * Raiz de la SPA de Cuidarte+.
 *
 * Resuelve tres cosas:
 *  1. El estado de sesion, rehidratado desde `sessionStorage` y revalidado
 *     contra el servidor al arrancar. Revalidar es necesario porque el token
 *     guardado puede haber sido revocado en un logout desde otra pestana
 *     (RF-1.2): confiar en el dato local mostraria una interfaz autenticada
 *     con una sesion muerta.
 *  2. La navegacion, que depende del rol. El menu de auditoria solo se muestra
 *     a ADMIN, pero esa es una decision de interfaz: la autorizacion real la
 *     aplica el backend (NFR-SEG-4).
 *  3. El flujo escalonado paciente -> examenes que exige NFR-USAB-4.
 */
export function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [vista, setVista] = useState('pacientes');
  const [pacienteActivo, setPacienteActivo] = useState(null);
  const [verificando, setVerificando] = useState(Boolean(leerSesion()));

  // Revalidacion de la sesion rehidratada contra el servidor.
  useEffect(() => {
    /*
     * `verificando` ya nace en false cuando no hay sesion rehidratada, por lo
     * que aqui basta con salir. Llamar setState de forma sincronica en el
     * cuerpo del efecto provoca un render en cascada y lo prohibe la regla
     * react-hooks/set-state-in-effect.
     */
    if (!sesion) {
      return undefined;
    }
    let vigente = true;
    api
      .yo(sesion.token)
      .catch(() => {
        if (vigente) {
          borrarSesion();
          setSesion(null);
        }
      })
      .finally(() => {
        if (vigente) {
          setVerificando(false);
        }
      });
    return () => {
      vigente = false;
    };
    // Se ejecuta una sola vez por token: no debe reintentar en cada render.
  }, [sesion?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  function iniciarSesion(nuevaSesion) {
    guardarSesion(nuevaSesion);
    setSesion(nuevaSesion);
    setVista('pacientes');
    setPacienteActivo(null);
  }

  async function cerrarSesion() {
    try {
      // Se avisa al servidor para que revoque el token (RF-1.2); si la red
      // falla, la sesion local se limpia igualmente.
      await api.logout(sesion.token);
    } catch {
      // Sin accion: el cierre local procede de todos modos.
    }
    borrarSesion();
    setSesion(null);
    setPacienteActivo(null);
  }

  if (verificando) {
    return (
      <main className="contenido" id="contenido">
        <p aria-live="polite">Verificando la sesion...</p>
      </main>
    );
  }

  if (!sesion) {
    return (
      <>
        <header className="cabecera">
          <div className="cabecera__barra">
            <h1 className="cabecera__titulo">Cuidarte+</h1>
            <span className="cabecera__sesion">Sistema de examenes medicos</span>
          </div>
        </header>
        <Acceso onSesionIniciada={iniciarSesion} />
      </>
    );
  }

  const esAdmin = sesion.usuario.rol === 'ADMIN';
  const pestanas = [
    { clave: 'pacientes', etiqueta: 'Pacientes' },
    ...(esAdmin ? [{ clave: 'auditoria', etiqueta: 'Auditoria' }] : []),
  ];

  return (
    <>
      <header className="cabecera">
        <div className="cabecera__barra">
          <h1 className="cabecera__titulo">Cuidarte+</h1>
          <div className="cabecera__sesion">
            <span>
              {sesion.usuario.nombreUsuario}
              {' · '}
              {NOMBRE_ROL[sesion.usuario.rol] ?? sesion.usuario.rol}
            </span>
            <button className="boton boton--secundario" type="button" onClick={cerrarSesion}>
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <nav className="navegacion" aria-label="Secciones principales">
        <ul className="navegacion__lista">
          {pestanas.map((pestana) => (
            <li key={pestana.clave}>
              <button
                className="navegacion__boton"
                type="button"
                aria-current={vista === pestana.clave ? 'page' : undefined}
                onClick={() => {
                  setVista(pestana.clave);
                  setPacienteActivo(null);
                }}
              >
                {pestana.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="contenido" id="contenido">
        {vista === 'pacientes' &&
          (pacienteActivo ? (
            <Examenes
              sesion={sesion}
              paciente={pacienteActivo}
              onVolver={() => setPacienteActivo(null)}
            />
          ) : (
            <Pacientes sesion={sesion} onSeleccionarPaciente={setPacienteActivo} />
          ))}

        {vista === 'auditoria' && <Auditoria sesion={sesion} />}
      </main>
    </>
  );
}
