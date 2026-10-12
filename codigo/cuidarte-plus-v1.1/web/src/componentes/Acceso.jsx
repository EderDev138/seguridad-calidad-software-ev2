import { useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { Aviso } from './Aviso.jsx';

/**
 * Campo de formulario con etiqueta asociada y pista opcional.
 *
 * Se extrae como componente por dos razones: evita repetir el cableado de
 * accesibilidad (`htmlFor`/`id`/`aria-describedby`) en cada campo —que es
 * donde suelen aparecer los defectos de accesibilidad— y mantiene baja la
 * complejidad del formulario (ISO/IEC 25010, mantenibilidad).
 *
 * La etiqueta es un `<label>` real y no un placeholder: el placeholder
 * desaparece al escribir y los lectores de pantalla no lo anuncian de forma
 * fiable (WCAG 3.3.2).
 */
function Campo({
  id,
  etiqueta,
  tipo,
  valor,
  onCambio,
  autoComplete,
  pista = null,
  invalido = false,
}) {
  const idPista = pista ? `${id}-pista` : undefined;
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        className="campo__entrada"
        id={id}
        name={id}
        type={tipo}
        autoComplete={autoComplete}
        required
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        aria-invalid={invalido ? 'true' : 'false'}
        aria-describedby={idPista}
      />
      {pista && (
        <span className="campo__pista" id={idPista}>
          {pista}
        </span>
      )}
    </div>
  );
}

/**
 * Pantalla de acceso: inicio de sesion y autorregistro (RF-1.1, RF-2.1).
 *
 * Notas de usabilidad (NFR-USAB-2, NFR-USAB-3):
 *  - La politica de contrasenas se muestra ANTES de escribir, en vez de
 *    reprochar el error despues.
 *  - El error se marca con `aria-invalid` y se anuncia mediante `Aviso`, que
 *    lleva `role="alert"`.
 *
 * Nota de seguridad: la validacion de aqui es solo ayuda al usuario. La
 * autoridad es el servidor, que revalida todo (NFR-SEG-4).
 */
export function Acceso({ onSesionIniciada }) {
  const [modo, setModo] = useState('login');
  const [formulario, setFormulario] = useState({ nombreUsuario: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const esRegistro = modo === 'registro';
  const actualizar = (campo) => (valor) =>
    setFormulario((previo) => ({ ...previo, [campo]: valor }));

  function cambiarModo() {
    setModo(esRegistro ? 'login' : 'registro');
    setError(null);
    setExito(null);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setExito(null);
    setEnviando(true);
    try {
      if (esRegistro) {
        await api.registro(formulario.nombreUsuario, formulario.email, formulario.password);
        setExito('Cuenta creada correctamente. Ya puede iniciar sesion.');
        setModo('login');
        setFormulario((previo) => ({ ...previo, password: '' }));
      } else {
        onSesionIniciada(await api.login(formulario.nombreUsuario, formulario.password));
      }
    } catch (fallo) {
      const esApi = fallo instanceof ErrorApi;
      setError({
        mensaje: esApi ? fallo.mensaje : 'No fue posible conectar con el servidor',
        detalle: esApi ? fallo.detalle : null,
      });
    } finally {
      setEnviando(false);
    }
  }

  let textoBoton = esRegistro ? 'Crear cuenta' : 'Ingresar';
  if (enviando) {
    textoBoton = 'Procesando...';
  }

  return (
    <main className="contenido" id="contenido">
      <section className="panel" style={{ maxWidth: '30rem', margin: '0 auto' }}>
        <h1 className="panel__titulo">{esRegistro ? 'Crear una cuenta' : 'Iniciar sesion'}</h1>
        <p className="panel__ayuda">
          {esRegistro
            ? 'Al registrarse accedera como paciente y podra consultar sus examenes medicos.'
            : 'Ingrese su nombre de usuario y su contrasena para acceder a Cuidarte+.'}
        </p>

        <Aviso tipo="error" mensaje={error?.mensaje} detalle={error?.detalle} />
        <Aviso tipo="exito" mensaje={exito} />

        <form onSubmit={enviar} noValidate>
          <Campo
            id="nombreUsuario"
            etiqueta="Nombre de usuario"
            tipo="text"
            autoComplete="username"
            valor={formulario.nombreUsuario}
            onCambio={actualizar('nombreUsuario')}
            invalido={Boolean(error)}
            pista={
              esRegistro
                ? 'Entre 3 y 60 caracteres. Se permiten letras, numeros, punto, guion y guion bajo.'
                : null
            }
          />

          {esRegistro && (
            <Campo
              id="email"
              etiqueta="Correo electronico"
              tipo="email"
              autoComplete="email"
              valor={formulario.email}
              onCambio={actualizar('email')}
            />
          )}

          <Campo
            id="password"
            etiqueta="Contrasena"
            tipo="password"
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            valor={formulario.password}
            onCambio={actualizar('password')}
            invalido={Boolean(error)}
            pista={
              esRegistro
                ? 'Minimo 12 caracteres, con mayuscula, minuscula, numero y simbolo.'
                : null
            }
          />

          <div className="acciones">
            <button className="boton" type="submit" disabled={enviando}>
              {textoBoton}
            </button>
            <button className="boton boton--secundario" type="button" onClick={cambiarModo}>
              {esRegistro ? 'Ya tengo cuenta' : 'Quiero registrarme'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
