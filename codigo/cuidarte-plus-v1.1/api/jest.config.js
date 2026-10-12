/**
 * Configuracion de Jest.
 *
 * El proyecto usa modulos ESM nativos, por eso no hay transformacion (`babel`
 * o `ts-jest`): se ejecuta con `node --experimental-vm-modules`.
 *
 * Los umbrales de cobertura implementan NFR-CAL-1: el build falla si la
 * cobertura cae por debajo del minimo, de modo que la metrica es una puerta de
 * calidad y no un numero informativo.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/infrastructure/adapters/postgres/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 80,
      statements: 80,
      branches: 70,
      functions: 80,
    },
  },
  verbose: false,
  testTimeout: 20000,
};
