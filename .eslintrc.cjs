module.exports = {
    env: {
        es6: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2023,
    },
    extends: [
        'eslint:recommended',
        'airbnb-base'
    ],
    rules: {
        'no-param-reassign': 'off',
        'no-empty': 'off',
        'no-underscore-dangle': 'off',
        'import/extensions': 'off',
        'no-console': 'off',
        'comma-dangle': 'off',
        indent: ['error', 4],
        'object-curly-newline': 'off',
        'max-len': ['error', { code: 150 }],
    },
};
