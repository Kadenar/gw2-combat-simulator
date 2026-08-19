import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'build/**', 'reference-repos/**']
  },

  // JavaScript
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],

    plugins: {
      '@stylistic': stylistic
    },

    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        // Blank line after block-like statements
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*'
        },

        // ALWAYS require a blank line before an if statement.
        // Keep this last so broader rules don't override it.
        {
          blankLine: 'always',
          prev: '*',
          next: 'if'
        }
      ]
    }
  },

  // TypeScript
  {
    files: ['**/*.{ts,tsx}'],

    languageOptions: {
      parser: tseslint.parser
    },

    plugins: {
      '@stylistic': stylistic
    },

    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*'
        }
      ]
    }
  }
];
