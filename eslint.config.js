import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.js', '*.config.ts'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // DOM / browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        PointerEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        Image: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        matchMedia: 'readonly',
        location: 'readonly',
        history: 'readonly',
        alert: 'readonly',
        URLSearchParams: 'readonly',
        AudioContext: 'readonly',
        OscillatorType: 'readonly',
        ServiceWorkerRegistration: 'readonly',
        BeforeInstallPromptEvent: 'readonly',
        // ES built-ins
        Math: 'readonly',
        JSON: 'readonly',
        Date: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        isFinite: 'readonly',
        isNaN: 'readonly',
        Infinity: 'readonly',
        NaN: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      // TypeScript's own checker handles undefined identifiers, and no-undef
      // wrongly flags DOM lib type names (HTMLButtonElement, Node, …).
      'no-undef': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  prettier,
];
