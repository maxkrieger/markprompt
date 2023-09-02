module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/stylistic',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'next/core-web-vitals',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json'],
      },
      node: true,
    },
  },
  rules: {
    'import/order': [
      'error',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
        ],
        pathGroups: [{ pattern: '@/**', group: 'internal' }],
        'newlines-between': 'always',
      },
    ],
  },
  overrides: [
    {
      files: ['next.config.js', 'tailwind.config.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['*.test.ts', '*.test.tsx'],
      extends: [
        'plugin:jest-dom/recommended',
        'plugin:testing-library/react',
        'plugin:vitest/recommended',
      ],
    },
  ],
};
