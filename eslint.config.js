import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import codeComplete from 'eslint-plugin-code-complete';
import importPlugin from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist/**',
    'build/**',
    'node_modules/**',
    'coverage/**',
    'vite.config.ts',
    'postcss.config.js',
    'tailwind.config.js',
    '.github/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tsConfigs.recommendedTypeChecked,
      ...tsConfigs.strictTypeChecked,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      reactRefresh.configs.recommended,
      eslintPluginUnicorn.configs.all,
      eslintPluginPrettierRecommended,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
      sonarjs.configs.recommended,
    ],
    plugins: {
      'unused-imports': unusedImports,
      'code-complete': codeComplete,
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      // === UNUSED IMPORTS DETECTION ===
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // === TypeScript CONSISTENT IMPORTS ===
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // === IMPORT ORGANIZATION ===
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'never',
          pathGroups: [
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '../types',
              group: 'parent',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': ['error', { 'prefer-inline': false }],
      'import/no-unresolved': 'error',

      // === DISABLE CONFLICTING RULES ===
      '@typescript-eslint/no-unused-vars': 'off', // Use unused-imports plugin
      'no-unused-vars': 'off', // Use unused-imports plugin

      // === UNICORN OVERRIDES ===
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/prefer-export-from': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/require-post-message-target-origin': 'off',

      'sonarjs/void-use': 'off',
      'sonarjs/todo-tag': 'off',

      'code-complete/no-late-argument-usage': 'error',
      'code-complete/enforce-meaningful-names': 'error',
      'code-complete/no-magic-numbers-except-zero-one': 'error',
      'code-complete/no-boolean-params': 'error',

      // Type safety
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Performance and best practices
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',

      // Consistency
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/member-ordering': 'error',

      // JavaScript base rules (enhanced) - Prettier handles formatting
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',

      // Code quality rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',

      // Error prevention
      'no-unreachable': 'error',
      'no-useless-return': 'error',
      'no-unused-private-class-members': 'error',
      'require-atomic-updates': 'error',

      // React performance
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      'react/no-unused-prop-types': 'error',
      'react/no-unused-state': 'error',
      'react/prefer-stateless-function': 'warn',

      // React consistency
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/jsx-pascal-case': 'error',
      'react/self-closing-comp': 'error',

      // Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // === CODE QUALITY ===
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    // AI provider rules
    files: ['src/lib/providers/**/*.ts'],
    rules: {
      'code-complete/no-magic-numbers-except-zero-one': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-duplicate-imports': 'off',
    },
  },
  {
    // Test files - more relaxed rules
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'unicorn/consistent-function-scoping': 'off',
    },
  },
  {
    // Storybook files - disable some rules
    files: ['stories/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tsConfigs.recommended, // Use non-type-checked config for stories
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      eslintPluginUnicorn.configs.recommended,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.storybook.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'import/no-default-export': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Use unused-imports plugin
    },
  },
]);
