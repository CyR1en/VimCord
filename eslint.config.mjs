import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

export default defineConfig([
    globalIgnores(['VimCord.plugin.js']),
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                BdApi: 'readonly',
            },
        },
    },
    {
        files: ['scripts/**/*.{js,mjs,cjs}', 'eslint.config.mjs'],
        languageOptions: {
            globals: globals.node,
        },
    },
    prettier,
    {
        rules: {
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-multi-assign': 'error',
            'no-nested-ternary': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },
]);
