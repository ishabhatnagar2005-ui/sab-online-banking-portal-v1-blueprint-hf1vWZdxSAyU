import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: [
      'src/test/**',
      'src/**/*.{test,spec}.{js,jsx}',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Application network access is forbidden.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Application network access is forbidden.',
        },
        {
          name: 'WebSocket',
          message: 'Application network access is forbidden.',
        },
        {
          name: 'EventSource',
          message: 'Application network access is forbidden.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message: 'Application network access is forbidden.',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Application network access is forbidden.',
        },
        {
          object: 'navigator',
          property: 'sendBeacon',
          message: 'Application network access is forbidden.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{jsx,tsx}'],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
    },
  },
  {
    files: [
      'src/test/**/*.{js,jsx}',
      'src/**/*.{test,spec}.{js,jsx}',
      'tests/**/*.{js,jsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['*.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];