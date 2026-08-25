module.exports = {
  displayName: 'wallet-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',

  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },

  moduleNameMapper: {
    '^@payflow/database$':
      '<rootDir>/src/test/mocks/database.mock.ts',
  },

  testPathIgnorePatterns: [
    '<rootDir>/src/app/customer-features/customer-features.database-idempotency.test.ts',
  ],

  moduleFileExtensions: [
    'ts',
    'js',
    'html',
  ],

  coverageDirectory:
    '../../coverage/apps/wallet-service',
};
