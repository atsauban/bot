// Flat config for ESLint v9+
import pluginImport from 'eslint-plugin-import';

export default [
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ignores: ['node_modules/**', 'storage/**', 'dist/**', '.husky/**', '.git/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: { import: pluginImport },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'import/no-unresolved': 'off',
    },
  },
];
