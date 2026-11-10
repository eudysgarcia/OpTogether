/** Pruebas de integración contra Supabase (requiere `npx supabase start`). */
module.exports = {
  preset: 'jest-expo/node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
};
