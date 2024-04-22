import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node
        },
        ignores: [
            'dist/*',
            'docs/*',
            'logs/*',
            'coverage/*',
            'node-modules/*',
            'webpack.config.js',
            'sandbox.js'
        ],
        rules: {
            'no-console': 'off',
            'comma-dangle': 'off',
            indent: ['error', 4],
        }
    }
];
