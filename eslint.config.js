import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

const packageAliasPattern = {
  regex: '^\\.',
  message: 'Use the package alias so TypeScript, Vite, and Node resolve the same module.'
};
const platformBoundaryPattern = {
  regex: '(^|/)app(/|$)',
  message: 'Platform modules must not depend on browser application code.'
};
const engineBoundaryPattern = {
  regex: '(^|/)content/professions(/|$)|(^|/)app(/|$)',
  message: 'Engine modules may depend only on shared platform contracts.'
};

// Flat config replaces overlapping rule arrays, so every boundary includes the shared alias restriction.
function restrictedImports(...patterns) {
  return ['error', { patterns: [packageAliasPattern, ...patterns] }];
}

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

  // Source packages use aliases for consistent TypeScript, Vite, and Node resolution.
  {
    files: [
      'js/app/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/games/gw2/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/kernel/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/ui/**/*.{js,jsx,mjs,cjs,ts,tsx}'
    ],
    // The neutral worker harness reaches the game registry, which has no shared package alias.
    ignores: ['js/app/simulation/game-worker-harness.ts'],
    rules: {
      'no-restricted-imports': restrictedImports()
    }
  },

  // Neutral packages cannot acquire application or game dependencies.
  {
    files: ['js/kernel/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#(?:app|gw2|ui)/|(?:^|/)app/|(?:^|/)games/|(?:^|/)ui/',
        message: 'Kernel modules must remain independent of UI, applications, and games.'
      })
    }
  },
  {
    files: ['js/ui/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#(?:app|gw2)/|(?:^|/)games/|platform/gw2',
        message: 'Neutral UI modules must not depend on applications or games.'
      })
    }
  },
  {
    files: ['js/app/shell/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|(?:^|/)games/|platform/gw2',
        message: 'The shared application shell must not depend on GW2 modules.'
      })
    }
  },
  {
    files: ['js/app/**/*.d.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|platform/gw2',
        message: 'Shared application declarations must not depend on GW2 modules.'
      })
    }
  },

  // Platform primitives must not depend on browser application code.
  {
    files: ['js/games/gw2/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(platformBoundaryPattern)
    }
  },

  // Neutral engine primitives must not depend on profession implementations or browser application code.
  {
    files: ['js/games/gw2/platform/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(engineBoundaryPattern)
    }
  },

  // The runtime engine is phase-oriented. Keep implementation details from
  // crossing between execution/scheduling and resolution.
  {
    files: ['js/games/gw2/platform/engine/execution/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(engineBoundaryPattern, {
        regex: '(^|/)(resolution|resolver)(/|$)',
        message: 'Execution modules must communicate with resolution through shared contracts and events.'
      })
    }
  },
  {
    files: ['js/games/gw2/platform/engine/resolution/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(engineBoundaryPattern, {
        regex: '(^|/)(execution|scheduler)(/|$)',
        message: 'Resolution modules must consume scheduled events without importing execution internals.'
      })
    }
  },
  {
    files: ['js/games/gw2/platform/scheduler/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(platformBoundaryPattern, {
        regex: '(^|/)(resolution|resolver)(/|$)',
        message: 'Execution modules must communicate with resolution through shared contracts and events.'
      })
    }
  },
  {
    files: ['js/games/gw2/platform/resolver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(platformBoundaryPattern, {
        regex: '(^|/)(execution|scheduler)(/|$)',
        message: 'Resolution modules must consume scheduled events without importing execution internals.'
      })
    }
  },

  // Headless profession content must not load its browser application adapter.
  {
    files: ['js/games/gw2/content/professions/**/*.{ts,tsx}'],
    ignores: ['js/games/gw2/content/professions/**/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '(^|/)app(/|$)',
        message: 'Profession content must not import application or browser modules.'
      })
    }
  },

  // Core contributes upward and never depends on elite specialization content.
  {
    files: ['js/games/gw2/content/professions/**/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '(^|/)app(/|$)',
          message: 'Profession content must not import application or browser modules.'
        },
        {
          regex: '(^|/)specializations(/|$)',
          message: 'Core profession modules must not depend on elite specialization content.'
        }
      )
    }
  },

  // Generated/static profession data contributes upward and cannot reach into behavior owners.
  {
    files: ['js/games/gw2/content/professions/**/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '(^|/)(app|core|specializations)(/|$)|(^|/)presentation\\.js$',
        message: 'Profession data must not import behavior, presentation, or application modules.'
      })
    }
  },

  // Concept-owned simulation behavior may expose presentation data, but it
  // must not depend on browser integration or its composition root.
  {
    files: [
      'js/games/gw2/content/professions/**/{mechanics,skills,traits,state}.{ts,tsx}',
      'js/games/gw2/content/professions/**/{mechanics,skills,traits,state}/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '(^|/)app(/|$)',
          message: 'Simulation content must not import application or browser modules.'
        },
        {
          regex: 'content/professions/[^/]+/(?:core|specializations/[^/]+)/module\\.js$',
          message: 'Concept modules must contribute to module.ts without importing the composition root.'
        }
      )
    }
  },

  // Core concept modules retain both ownership restrictions when the broader concept rule overlaps.
  {
    files: [
      'js/games/gw2/content/professions/**/core/{mechanics,skills,traits,state}.{ts,tsx}',
      'js/games/gw2/content/professions/**/core/{mechanics,skills,traits,state}/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '(^|/)app(/|$)',
          message: 'Simulation content must not import application or browser modules.'
        },
        {
          regex: '(^|/)specializations(/|$)',
          message: 'Core profession modules must not depend on elite specialization content.'
        },
        {
          regex: 'content/professions/[^/]+/(?:core|specializations/[^/]+)/module\\.js$',
          message: 'Concept modules must contribute to module.ts without importing the composition root.'
        }
      )
    }
  }
];
