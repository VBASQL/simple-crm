// @ts-check
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['lib/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.eslint.json' },
      },
    },
    rules: {
      // CLAUDE.md §4/§5: no console anywhere; errors are thrown, logged once at root.
      'no-console': 'error',
      // §6: no blind spots.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-fallthrough': 'error',
      // §2: one-way import direction  app -> domain <- infra.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: './src/app',
              message: 'domain must not import from app (see CLAUDE.md §2).',
            },
            {
              target: './src/domain',
              from: './src/infra',
              message: 'domain must not import from infra (see CLAUDE.md §2).',
            },
            {
              target: './src/domain',
              from: './src/shared/firebase',
              message: 'domain must stay free of Firebase imports (see CLAUDE.md §2).',
            },
          ],
        },
      ],
    },
  },
  // Tests and fakes may be looser but still typed.
  {
    files: ['src/**/*.test.ts', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // In-memory fakes satisfy async port signatures without awaiting.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
