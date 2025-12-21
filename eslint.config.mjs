// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    {
        ignores: [
            'eslint.config.mjs',
            'commitlint.config.mjs',
            `scripts/*`,
            'dist/**',
            'node_modules/**',
        ],
    },

    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    prettierRecommended,

    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    {
        rules: {
            /* -------------------- Prettier -------------------- */
            'prettier/prettier': ['error', { endOfLine: 'auto' }],

            /* -------------------- TypeScript ------------------ */
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],

            /* -------------------- Async Safety ---------------- */
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/require-await': 'warn',

            /* -------------------- Clean Code ------------------ */
            'no-console': 'off',
            'no-debugger': 'warn',
            eqeqeq: ['error', 'always'],
        },
    },
);
