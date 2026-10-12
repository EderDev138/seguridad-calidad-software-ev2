/**
 * Cuidarte+ · Verificador de contraste WCAG
 * Caso CP-USA-01 · NFR-USAB-1, WCAG 2.1 criterio 1.4.3, Ley 20.422
 *
 * Lee los colores declarados en `web/src/estilos.css` y calcula la relacion de
 * contraste real de cada par texto/fondo que la interfaz utiliza.
 *
 * Por que un script y no solo una captura de Lighthouse:
 *  - Lighthouse audita la pagina renderizada, por lo que necesita el navegador
 *    y la aplicacion levantada, y solo revisa los elementos presentes en ese
 *    momento. Un mensaje de error que no se mostro no se audita.
 *  - Este verificador revisa la FUENTE de los colores, de modo que cubre todos
 *    los estados (error, exito, aviso) aunque no esten en pantalla, y entrega
 *    un numero reproducible que se puede citar en el informe.
 *  - Ambas tecnicas son complementarias: este da el valor exacto por token,
 *    Lighthouse confirma el resultado sobre el DOM real.
 *
 * Formula: WCAG 2.1, relative luminance y contrast ratio.
 *   https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Uso:
 *   node verificar-contraste.mjs ../codigo/cuidarte-plus-v1.1/web/src/estilos.css
 */

import fs from 'node:fs/promises';
import process from 'node:process';

/** Umbrales de WCAG 2.1 nivel AA. */
const MINIMO_TEXTO_NORMAL = 4.5; // criterio 1.4.3
const MINIMO_TEXTO_GRANDE = 3.0; // criterio 1.4.3 (>= 18.66px negrita o 24px)
const MINIMO_COMPONENTES = 3.0; // criterio 1.4.11 (bordes, iconos)

function hexARgb(hex) {
  const limpio = hex.replace('#', '').trim();
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;
  return [
    parseInt(completo.slice(0, 2), 16),
    parseInt(completo.slice(2, 4), 16),
    parseInt(completo.slice(4, 6), 16),
  ];
}

/** Luminancia relativa segun la definicion de WCAG. */
function luminancia([r, g, b]) {
  const canal = (valor) => {
    const s = valor / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(hexA, hexB) {
  const la = luminancia(hexARgb(hexA));
  const lb = luminancia(hexARgb(hexB));
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Extrae los tokens `--nombre: #rrggbb` declarados en la hoja de estilos. */
function extraerTokens(css) {
  const tokens = {};
  const patron = /--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let coincidencia = patron.exec(css);
  while (coincidencia !== null) {
    tokens[coincidencia[1]] = coincidencia[2].toLowerCase();
    coincidencia = patron.exec(css);
  }
  return tokens;
}

/**
 * Pares que la interfaz realmente usa. El tercer elemento es el umbral que
 * corresponde segun el tipo de elemento.
 */
const PARES = [
  ['texto', 'superficie', MINIMO_TEXTO_NORMAL, 'Texto principal sobre panel'],
  ['texto', 'fondo', MINIMO_TEXTO_NORMAL, 'Texto principal sobre el fondo'],
  ['texto-suave', 'superficie', MINIMO_TEXTO_NORMAL, 'Texto secundario y pistas de campo'],
  ['primario', 'superficie', MINIMO_COMPONENTES, 'Borde y foco de los controles'],
  ['error', 'error-fondo', MINIMO_TEXTO_NORMAL, 'Mensaje de error'],
  ['exito', 'exito-fondo', MINIMO_TEXTO_NORMAL, 'Mensaje de exito'],
  ['aviso', 'aviso-fondo', MINIMO_TEXTO_NORMAL, 'Mensaje de aviso'],
  ['borde', 'superficie', MINIMO_COMPONENTES, 'Borde de campos y paneles'],
];

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    process.stderr.write('Uso: node verificar-contraste.mjs <ruta a estilos.css>\n');
    process.exit(1);
  }

  const css = await fs.readFile(ruta, 'utf8');
  const tokens = extraerTokens(css);

  const lineas = [];
  lineas.push(`Hoja de estilos analizada: ${ruta}`);
  lineas.push('');
  lineas.push('Umbrales WCAG 2.1 nivel AA:');
  lineas.push(`  texto normal     >= ${MINIMO_TEXTO_NORMAL.toFixed(1)}:1   (criterio 1.4.3)`);
  lineas.push(`  texto grande     >= ${MINIMO_TEXTO_GRANDE.toFixed(1)}:1   (criterio 1.4.3)`);
  lineas.push(`  componentes UI   >= ${MINIMO_COMPONENTES.toFixed(1)}:1   (criterio 1.4.11)`);
  lineas.push('');
  lineas.push(
    'ELEMENTO'.padEnd(38) +
      'FRENTE'.padEnd(10) +
      'FONDO'.padEnd(10) +
      'RATIO'.padEnd(9) +
      'MINIMO'.padEnd(8) +
      'RESULTADO',
  );
  lineas.push('-'.repeat(88));

  let incumplimientos = 0;
  for (const [frente, fondo, minimo, descripcion] of PARES) {
    const colorFrente = tokens[frente];
    const colorFondo = tokens[fondo];
    if (!colorFrente || !colorFondo) {
      lineas.push(`${descripcion.padEnd(38)}token no encontrado (${frente} / ${fondo})`);
      continue;
    }
    const ratio = contraste(colorFrente, colorFondo);
    const cumple = ratio >= minimo;
    if (!cumple) {
      incumplimientos += 1;
    }
    lineas.push(
      descripcion.padEnd(38) +
        colorFrente.padEnd(10) +
        colorFondo.padEnd(10) +
        `${ratio.toFixed(2)}:1`.padEnd(9) +
        `${minimo.toFixed(1)}:1`.padEnd(8) +
        (cumple ? 'CUMPLE' : 'INCUMPLE  <-- WCAG 1.4.3'),
    );
  }

  lineas.push('');
  if (incumplimientos === 0) {
    lineas.push('Resultado: todos los pares de color cumplen el umbral de WCAG 2.1 AA.');
  } else {
    lineas.push(
      `Resultado: ${incumplimientos} par(es) de color INCUMPLEN el umbral de WCAG 2.1 AA.`,
    );
    lineas.push('');
    lineas.push('Impacto: una persona con baja vision no distingue el texto de su fondo.');
    lineas.push('El ERS senala expresamente a los adultos mayores como usuarios objetivo');
    lineas.push('(NFR-USAB-1), y la Ley 20.422 exige accesibilidad para personas con');
    lineas.push('discapacidad. El mensaje de error es el caso mas grave: es justamente la');
    lineas.push('informacion que el usuario necesita leer para corregir su accion.');
  }

  // Verificacion complementaria: regiones vivas para anunciar los mensajes.
  lineas.push('');
  lineas.push('--- Anuncio de mensajes de estado (WCAG 4.1.3) ---');
  const avisoRuta = ruta.replace(/estilos\.css$/, 'componentes/Aviso.jsx');
  try {
    const aviso = await fs.readFile(avisoRuta, 'utf8');
    /*
     * Se eliminan los comentarios antes de buscar los atributos: el propio
     * archivo DOCUMENTA por que usa `role` y `aria-live`, de modo que buscar
     * en el texto completo daria un falso positivo incluso si los atributos
     * fueron retirados del JSX.
     */
    const codigo = aviso.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const tieneRole = /role=["'](alert|status)["']/.test(codigo) || /role=\{[^}]*(alert|status)/.test(codigo);
    const tieneAriaLive = /aria-live/.test(codigo);
    lineas.push(`Archivo: ${avisoRuta}`);
    lineas.push(`  role="alert" / role="status" : ${tieneRole ? 'PRESENTE' : 'AUSENTE'}`);
    lineas.push(`  aria-live                    : ${tieneAriaLive ? 'PRESENTE' : 'AUSENTE'}`);
    if (!tieneRole || !tieneAriaLive) {
      lineas.push('');
      lineas.push('INCUMPLE WCAG 4.1.3: el lector de pantalla no anuncia los mensajes.');
      lineas.push('Una persona ciega completa el formulario, lo envia, falla, y no');
      lineas.push('recibe ninguna senal de que ocurrio un error.');
    } else {
      lineas.push('  Correcto: los mensajes se anuncian al lector de pantalla.');
    }
  } catch {
    lineas.push(`(no se pudo leer ${avisoRuta})`);
  }

  process.stdout.write(lineas.join('\n') + '\n');
  process.exit(incumplimientos > 0 ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(2);
});
