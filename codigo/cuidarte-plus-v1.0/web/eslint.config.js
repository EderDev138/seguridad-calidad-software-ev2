import js from '@eslint/js';
import globals from 'globals';
import a11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

/**
 * Configuracion de ESLint para la SPA.
 *
 * Cuatro capas, cada una con un proposito distinto en el plan de pruebas:
 *  1. `js.configs.recommended` — correccion del codigo.
 *  2. `eslint-plugin-jsx-a11y` — ACCESIBILIDAD como analisis estatico. Detecta
 *     sin ejecutar la aplicacion los defectos que el caso CP-USA-01 audita:
 *     controles sin etiqueta, imagenes sin texto alternativo, elementos
 *     clicables no accesibles por teclado. Es lo que convierte la
 *     accesibilidad en una puerta de calidad automatizable y no en una
 *     revision manual opcional.
 *  3. `eslint-plugin-react-hooks` — reglas de los hooks, cuya violacion
 *     produce fallos intermitentes dificiles de reproducir en pruebas.
 *  4. `eslint-plugin-react` — se usa solo por `jsx-uses-vars`/`jsx-uses-react`,
 *     que le ensenan a `no-unused-vars` que un identificador usado dentro de
 *     JSX si esta en uso. Sin estas reglas, cada componente importado se
 *     reporta como variable sin usar (falso positivo).
 *
 * Regla clave de seguridad: `dangerouslySetInnerHTML` queda prohibido por
 * `no-restricted-syntax`. Ese atributo es exactamente el vector del XSS
 * detectado en la version 1.0 (incidente INC-04): React escapa por defecto y
 * solo se pierde esa proteccion al usarlo.
 *
 * Restriccion de version documentada: este paquete fija ESLint 9 y no 10,
 * porque `eslint-plugin-jsx-a11y` todavia no declara compatibilidad con
 * ESLint 10. Se prefirio conservar el analisis estatico de accesibilidad
 * (que cubre requisitos del ERS: NFR-USAB-1 a 3) antes que subir de major el
 * linter. La API, que no usa este plugin, si corre sobre ESLint 10. La
 * limitacion queda registrada en el informe como riesgo tecnico a revisar
 * cuando el plugin publique soporte.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      'jsx-a11y': a11y,
      'react-hooks': reactHooks,
      react,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...a11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // --- Soporte de JSX para el analisis de variables --------------------
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',

      // --- Seguridad (NFR-SEG-5, OWASP A03) -------------------------------
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'Prohibido: dangerouslySetInnerHTML desactiva el escape de React y abre un vector de XSS (NFR-SEG-5). Renderice texto plano.',
        },
        {
          selector: 'CallExpression[callee.name="eval"]',
          message: 'Prohibido: eval permite ejecucion de codigo arbitrario.',
        },
      ],
      'no-script-url': 'error',

      // --- Accesibilidad reforzada (NFR-USAB-1 a 3, WCAG 2.1) -------------
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/aria-role': 'error',

      // --- Correccion ------------------------------------------------------
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',

      // --- Mantenibilidad (ISO/IEC 25010) ---------------------------------
      complexity: ['warn', 12],
      'max-depth': ['warn', 4],
    },
  },
  {
    /*
     * Archivos de configuracion y scripts: se ejecutan en Node, no en el
     * navegador, por lo que necesitan los globales de Node (`process`).
     */
    files: ['*.config.js', 'vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
