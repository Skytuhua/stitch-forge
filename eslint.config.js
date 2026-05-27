import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'dist-zip/**', 'node_modules/**', 'src/core/dmc-data.ts'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // TypeScript's compiler already reports undefined identifiers; the core
      // rule has no type info and false-flags DOM/WebWorker globals.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.config.ts', 'scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly' },
    },
    rules: { 'no-undef': 'off' },
  },
];
