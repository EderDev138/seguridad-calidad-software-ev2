import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';

/**
 * Configuracion de ESLint (analisis estatico / SAST del codigo propio).
 *
 * Dos capas:
 *  1. `js.configs.recommended` — correccion y malas practicas generales.
 *  2. `eslint-plugin-security` — reglas orientadas a seguridad: deteccion de
 *     `eval`, de regex con riesgo de ReDoS, de buffers no inicializados y de
 *     concatenacion en APIs sensibles. Es la capa que detecta los defectos de
 *     seguridad de la version 1.0 sin necesidad de ejecutar la aplicacion.
 */
export default [
  {
    ignores: ['coverage/**', 'node_modules/**', 'reports/**', 'storage-documentos/**'],
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // --- Seguridad (NFR-SEG-5) -------------------------------------------
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'security/detect-object-injection': 'off', // demasiado ruidoso con indices numericos
      'security/detect-non-literal-fs-filename': 'warn',

      // --- Correccion -------------------------------------------------------
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-return-await': 'error',
      'require-atomic-updates': 'off',

      // --- Mantenibilidad (ISO/IEC 25010) ----------------------------------
      complexity: ['warn', 12],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', { max: 120, skipComments: true, skipBlankLines: true }],
      'no-console': 'error', // la salida va por el logger estructurado, no por console
    },
  },
  {
    // Las pruebas pueden ser mas extensas y usan los globales de Jest.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'max-lines-per-function': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];
