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
        // Blank line after block-like statements, including ordinary braced if statements.
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*'
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
        // Blank line after block-like statements, including ordinary braced if statements.
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*'
        }
      ]
    }
  },

  // The runtime engine is phase-oriented. Keep implementation details from
  // crossing between execution/scheduling and resolution.
  {
    files: ['js/games/gw2/platform/engine/execution/**/*.{ts,tsx}', 'js/games/gw2/platform/scheduler/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(resolution|resolver)(/|$)',
              message: 'Execution modules must communicate with resolution through shared contracts and events.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['js/games/gw2/platform/engine/resolution/**/*.{ts,tsx}', 'js/games/gw2/platform/resolver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(execution|scheduler)(/|$)',
              message: 'Resolution modules must consume scheduled events without importing execution internals.'
            }
          ]
        }
      ]
    }
  },

  // Neutral engine primitives must not depend on profession implementations or browser application code.
  {
    files: ['js/games/gw2/platform/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)content/professions(/|$)|(^|/)app(/|$)',
              message: 'Engine modules may depend only on shared platform contracts.'
            }
          ]
        }
      ]
    }
  },

  // Generated/static profession data contributes upward and cannot reach into behavior owners.
  {
    files: ['js/games/gw2/content/professions/**/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(app|core|specializations)(/|$)|(^|/)presentation\\.js$',
              message: 'Profession data must not import behavior, presentation, or application modules.'
            }
          ]
        }
      ]
    }
  },

  // Concept-owned simulation behavior may expose presentation data, but it
  // must not depend on browser/application integration.
  {
    files: [
      'js/games/gw2/content/professions/**/data/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/mechanics/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/skills/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/traits/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/state/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/state.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)app(/|$)',
              message: 'Simulation content must not import application or browser modules.'
            }
          ]
        }
      ]
    }
  },

  // Module manifests are leaf composition roots; concepts contribute upward without importing them.
  {
    files: [
      'js/games/gw2/content/professions/**/mechanics/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/skills/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/traits/**/*.{ts,tsx}',
      'js/games/gw2/content/professions/**/state/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)module\\.js$',
              message: 'Concept modules must contribute to module.ts without importing the composition root.'
            }
          ]
        }
      ]
    }
  }
];
