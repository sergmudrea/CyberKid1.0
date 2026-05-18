// jest.config.js
// ПРОМЕТЕЙ: Альтернативная конфигурация Jest (для тех, у кого проблемы с парсингом package.json).

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^phaser$': '<rootDir>/src/__mocks__/phaser.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(phaser|seedrandom)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/types/**',
    '!src/main.ts',
    '!src/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
