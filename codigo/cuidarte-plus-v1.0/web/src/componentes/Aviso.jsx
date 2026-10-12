/**
 * Mensaje de error, exito o informacion.
 *
 * Este componente concentra tres controles de accesibilidad que el caso
 * CP-USA-01 audita y que la version 1.0 no cumplia (incidente INC-07):
 *
 *  1. `role="alert"` + `aria-live`: el lector de pantalla ANUNCIA el mensaje
 *     cuando aparece. Sin esto, una persona ciega completa un formulario, lo
 *     envia, falla y no recibe ninguna senal de que algo ocurrio (WCAG 4.1.3).
 *     Los errores usan `assertive` porque interrumpen la tarea; los avisos de
 *     exito usan `polite` para no cortar la lectura en curso.
 *  2. Un icono textual ademas del color: la informacion no se transmite solo
 *     por color (WCAG 1.4.1), de modo que tambien funciona en escala de grises
 *     o para alguien con daltonismo.
 *  3. Los colores de `estilos.css` alcanzan un contraste minimo de 4.5:1
 *     (WCAG 1.4.3).
 */

const ICONOS = {
  error: '⚠', // triangulo de advertencia
  exito: '✓', // marca de verificacion
  info: 'ℹ', // informacion
};

export function Aviso({ tipo = 'info', mensaje, detalle = null }) {
  if (!mensaje) {
    return null;
  }

  return (
    <div className={`aviso aviso--${tipo}`}>
      <span aria-hidden="true">{ICONOS[tipo] ?? ICONOS.info}</span>
      <div>
        {/* Texto plano: React escapa el contenido, de modo que un valor como
            "<script>alert(1)</script>" se muestra literal y no se ejecuta.
            Nunca se usa dangerouslySetInnerHTML en este proyecto. */}
        <p style={{ margin: 0 }}>{mensaje}</p>
        {Array.isArray(detalle) && detalle.length > 0 && (
          <ul className="aviso__lista">
            {detalle.map((item, indice) => (
              <li key={indice}>
                {typeof item === 'string' ? item : `${item.campo}: ${item.problema}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Region viva permanente para anunciar cambios de estado que no son errores
 * (por ejemplo, "cargando" o "se encontraron 12 pacientes").
 *
 * Debe existir en el DOM ANTES de recibir texto: un `aria-live` que se inserta
 * junto con su contenido no siempre se anuncia.
 */
export function RegionViva({ texto }) {
  return (
    <p className="campo__pista" style={{ minHeight: '1.4em' }}>
      {texto}
    </p>
  );
}
