import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const packageAliasPattern = {
  regex: '^\\.',
  message: 'Use the package alias so TypeScript, Vite, and Node resolve the same module.'
};
const platformBoundaryPattern = {
  regex: '(^|/)(app|integrations)(/|$)',
  message: 'Platform modules must not depend on application or integration code.'
};
const engineBoundaryPattern = {
  regex: '(^|/)professions(/|$)|(^|/)(app|integrations)(/|$)',
  message: 'Engine modules may depend only on shared platform contracts.'
};
const professionBoundaryPattern = {
  regex: '(^|/)(app|integrations)(/|$)',
  message: 'Headless profession content must not depend on application or integration code.'
};

// Code outside a profession folder may import only its public entry points (docs/architecture/MODULES.md). The
// shared professions/shared/ helpers are not a profession and stay importable.
const professionPublicEntryPatterns = [
  {
    regex:
      '^#gw2/professions/(?!shared/)[^/]+/(?!(?:core|specializations/[^/]+)/profiles\\.js$)(?:core/|specializations/|family-|catalog[./]|state|presentation|modules|definition)',
    message: 'Import professions through profession.js, app/app-definition.js, build/, types.js, data/, or profiles.js.'
  }
];
const moduleCompositionPattern = {
  regex: '^#gw2/professions/[^/]+/(?:profession|modules|definition)\\.js$|^#gw2/professions/.+/module\\.js$',
  message: 'Module manifests must not import the profession composition root or another module manifest.'
};
const coreSpecializationPattern = {
  regex: '(^|/)specializations(/|$)',
  message: 'Core profession modules must not depend on elite specialization content.'
};

// Flat config replaces overlapping rule arrays, so every boundary includes the shared alias restriction.
function restrictedImports(...patterns) {
  return ['error', { patterns: [packageAliasPattern, ...patterns] }];
}

export default [
  // ESLint owns source syntax coverage; exclude dependencies, generated artifacts, and local analysis/tool state.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'build/**',
      'reference-repos/**',
      '.scratch/**',
      '**/.analysis-inputs/**',
      '**/.claude/**',
      '**/.git/**',
      '**/.lavish/**'
    ]
  },

  // Parse all owned JavaScript (including root config, scripts, and tests); TypeScript remains compiler-checked.
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],

    plugins: {
      '@stylistic': stylistic
    },

    rules: {
      ...js.configs.recommended.rules,
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

  // Declare only the globals provided by each JavaScript file's runtime so no-undef remains useful.
  {
    files: [
      'eslint.config.js',
      'playwright.config.js',
      'vite.config.js',
      'scripts/**/*.{js,mjs,cjs}',
      'tests/**/*.{js,mjs,cjs}'
    ],
    languageOptions: {
      globals: globals.nodeBuiltin
    }
  },
  {
    files: ['js/app/page/github-pages-redirect.js', 'tests/browser/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.browser
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
    ignores: ['js/games/gw2/professions/**'],
    rules: {
      'no-restricted-imports': restrictedImports(...professionPublicEntryPatterns)
    }
  },
  {
    files: ['js/games/gw2/professions/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
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
    files: ['js/ui/rotation/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '^#(?:app|gw2)/|(?:^|/)games/|platform/gw2',
          message: 'Neutral UI modules must not depend on applications or games.'
        },
        {
          regex: '^#ui/results/',
          message: 'Neutral rotation UI must not depend on result views.'
        }
      )
    }
  },
  {
    files: [
      'js/app/shell/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/app/page/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/app/entry.ts',
      'js/app/bootstrap.ts'
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|(?:^|/)games/|platform/gw2',
        message: 'The shared application shell must not depend on GW2 modules.'
      })
    }
  },
  {
    files: ['js/app/page/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '^#gw2/|(?:^|/)games/|platform/gw2',
          message: 'The shared application shell must not depend on GW2 modules.'
        },
        {
          regex: '^#ui/|^#app/(?:game|shell)/',
          message: 'Page integration modules must remain leaves without UI, game-boundary, or shell dependencies.'
        }
      )
    }
  },
  {
    files: ['js/app/game/contracts.ts', 'js/app/shell/types.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|platform/gw2',
        message: 'Shared application declarations must not depend on GW2 modules.'
      })
    }
  },

  // Platform primitives must not depend on application or integration code.
  {
    files: ['js/games/gw2/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(platformBoundaryPattern, ...professionPublicEntryPatterns)
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
      'no-restricted-imports': restrictedImports(platformBoundaryPattern, ...professionPublicEntryPatterns, {
        regex: '(^|/)(resolution|resolver)(/|$)',
        message: 'Execution modules must communicate with resolution through shared contracts and events.'
      })
    }
  },
  {
    files: ['js/games/gw2/platform/resolver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(platformBoundaryPattern, ...professionPublicEntryPatterns, {
        regex: '(^|/)(execution|scheduler)(/|$)',
        message: 'Resolution modules must consume scheduled events without importing execution internals.'
      })
    }
  },

  // Headless profession content must not load its browser application adapter.
  {
    files: ['js/games/gw2/professions/**/*.{ts,tsx}'],
    ignores: ['js/games/gw2/professions/**/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(professionBoundaryPattern)
    }
  },

  // Core contributes upward and never depends on elite specialization content.
  {
    files: ['js/games/gw2/professions/**/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(professionBoundaryPattern, coreSpecializationPattern)
    }
  },

  // Generated/static profession data contributes upward and cannot reach into behavior owners.
  {
    files: ['js/games/gw2/professions/**/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '(^|/)(app|core|integrations|specializations)(/|$)|(^|/)presentation\\.js$',
        message: 'Profession data must not import behavior, presentation, application, or integration modules.'
      })
    }
  },

  // Elementalist catalog generation merges every module's declarative skill fragments before any module reads its
  // share, so its module-data may read the core and specialization skills/index.js declarations and nothing else.
  {
    files: ['js/games/gw2/professions/elementalist/data/module-data.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex:
          '(^|/)(app|integrations)(/|$)|(^|/)core/(?!skills/index\\.js$)|(^|/)specializations/(?![^/]+/skills/index\\.js$)|(^|/)presentation\\.js$',
        message: 'Profession data may read module skill declarations but no behavior, presentation, or application.'
      })
    }
  },

  // Concept-owned simulation behavior may expose presentation data, but it
  // must not depend on browser integration or its composition root.
  {
    files: [
      'js/games/gw2/professions/**/{mechanics,skills,traits,state}.{ts,tsx}',
      'js/games/gw2/professions/**/{mechanics,skills,traits,state}/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': restrictedImports(professionBoundaryPattern, {
        regex: 'professions/[^/]+/(?:core|specializations/[^/]+)/module\\.js$',
        message: 'Concept modules must contribute to module.ts without importing the composition root.'
      })
    }
  },

  // Core concept modules retain both ownership restrictions when the broader concept rule overlaps.
  {
    files: [
      'js/games/gw2/professions/**/core/{mechanics,skills,traits,state}.{ts,tsx}',
      'js/games/gw2/professions/**/core/{mechanics,skills,traits,state}/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': restrictedImports(professionBoundaryPattern, coreSpecializationPattern, {
        regex: 'professions/[^/]+/(?:core|specializations/[^/]+)/module\\.js$',
        message: 'Concept modules must contribute to module.ts without importing the composition root.'
      })
    }
  },

  // module.ts files are manifests: they compose owner files and never import composition roots. The profession
  // layout conformance test enforces that they declare nothing besides the module.
  {
    files: ['js/games/gw2/professions/*/specializations/*/module.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(professionBoundaryPattern, moduleCompositionPattern)
    }
  },
  {
    files: ['js/games/gw2/professions/*/core/module.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        professionBoundaryPattern,
        coreSpecializationPattern,
        moduleCompositionPattern
      )
    }
  }
];
