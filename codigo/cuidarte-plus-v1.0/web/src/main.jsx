import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './estilos.css';

/**
 * Punto de montaje de la SPA.
 *
 * `StrictMode` se mantiene activo: en desarrollo detecta efectos no idempotentes
 * y APIs obsoletas, que es justamente el tipo de defecto que las pruebas
 * funcionales no revelan.
 */
const contenedor = document.getElementById('raiz');
if (!contenedor) {
  throw new Error('No se encontro el contenedor #raiz en el documento');
}

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
