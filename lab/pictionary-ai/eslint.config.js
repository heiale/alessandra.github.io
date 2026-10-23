import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['client/src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
];
