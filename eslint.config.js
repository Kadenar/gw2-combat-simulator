import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const packageAliasPattern = {
  regex: '^\\.',
  message: 'Use the package alias so TypeScript, Vite, and Node resolve the same module.'
};
const sharedPlatformBoundaryPattern = {
  regex: '(^|/)professions(/|$)|(^|/)(app|integrations)(/|$)',
  message: 'Shared platform modules must receive profession contributions rather than import concrete implementations.'
};
const simulationImplementationPattern = {
  regex:
    '^#gw2/platform/simulation/(?:runtime|coordinator|internal-work|combat-producers|simulate|mechanic-context)\\.js$',
  message:
    'Domain owners receive runtime services through contracts; only composition may import simulation implementations.'
};
const aggregateRuntimePattern = {
  regex: '^#gw2/platform/simulation/runtime-state\\.js$',
  message: 'Declarations use domain capabilities rather than the aggregate simulation runtime.'
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
      'reference-repos/**',
      '.scratch/**',
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
    files: ['js/browser/page/github-pages-redirect.js', 'tests/browser/**/*.{js,mjs,cjs}'],
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

  // Typed internals should use their declared values directly; runtime input normalization is reviewed separately.
  {
    files: ['js/kernel/**/*.ts', 'js/games/gw2/platform/**/*.ts', 'js/games/gw2/professions/**/*.ts'],
    languageOptions: {
      // Missing dictionary/array entries are possible at runtime; lint must not remove their guards.
      parserOptions: { project: './tsconfig.lint.json', tsconfigRootDir: import.meta.dirname }
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unnecessary-type-conversion': 'error',
      '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Retain non-null assertions for owner/catalog invariants; reject only assertions that add no type information.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/no-useless-default-assignment': 'error'
    }
  },

  // Validation and normalization must still reject malformed JavaScript/JSON inputs, regardless of their TS types.
  {
    files: [
      'js/kernel/core/simulation-random.ts',
      'js/kernel/execution/observation.ts',
      'js/games/gw2/platform/builds/{codec,assumptions,attributes}.ts',
      'js/games/gw2/platform/combat/modifiers.ts',
      'js/games/gw2/platform/combos/{definitions,descriptors}.ts',
      'js/games/gw2/platform/profession-definition/compiler/compile-contract.ts',
      'js/games/gw2/platform/skills/{catalog,validation}.ts',
      'js/games/gw2/platform/effects/{validation,action-validation}.ts',
      'js/games/gw2/platform/profession-definition/profession.ts',
      'js/games/gw2/platform/execution/autoattack-chains.ts',
      'js/games/gw2/professions/*/build/build.ts'
    ],
    rules: { '@typescript-eslint/no-unnecessary-condition': 'off' }
  },
  // These entry points normalize untrusted or authored inputs whose runtime values can violate declared types.
  {
    files: [
      'js/kernel/core/simulation-random.ts',
      'js/kernel/events/queue.ts',
      'js/kernel/execution/observation.ts',
      'js/games/gw2/platform/builds/codec.ts',
      'js/games/gw2/platform/builds/assumptions.ts',
      'js/games/gw2/platform/builds/attribute-provenance.ts',
      'js/games/gw2/platform/skills/catalog.ts',
      'js/games/gw2/platform/skills/validation.ts',
      'js/games/gw2/platform/effects/validation.ts',
      'js/games/gw2/platform/combat/modifiers.ts'
    ],
    rules: {
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off'
    }
  },

  // Source packages use aliases for consistent TypeScript, Vite, and Node resolution.
  {
    files: [
      'js/browser/**/*.{js,jsx,mjs,cjs,ts,tsx}',
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
        regex: '^#(?:browser|gw2|ui)/|(?:^|/)(?:browser|app)/|(?:^|/)games/|(?:^|/)ui/',
        message: 'Kernel modules must remain independent of UI, applications, and games.'
      })
    }
  },
  {
    files: ['js/ui/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#(?:browser|gw2)/|(?:^|/)games/|platform/gw2',
        message: 'Neutral UI modules must not depend on applications or games.'
      })
    }
  },
  {
    files: ['js/ui/rotation/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '^#(?:browser|gw2)/|(?:^|/)games/|platform/gw2',
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
      'js/browser/shell/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/browser/page/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'js/browser/entry.ts',
      'js/browser/bootstrap.ts'
    ],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|(?:^|/)games/|platform/gw2',
        message: 'The shared application shell must not depend on GW2 modules.'
      })
    }
  },
  {
    files: ['js/browser/page/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        {
          regex: '^#gw2/|(?:^|/)games/|platform/gw2',
          message: 'The shared application shell must not depend on GW2 modules.'
        },
        {
          regex: '^#ui/|^#browser/(?:game|shell)/',
          message: 'Page integration modules must remain leaves without UI, game-boundary, or shell dependencies.'
        }
      )
    }
  },
  {
    files: ['js/browser/game/contracts.ts', 'js/browser/shell/types.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        regex: '^#gw2/|platform/gw2',
        message: 'Shared application declarations must not depend on GW2 modules.'
      })
    }
  },

  // Every shared domain retains the former engine restriction on concrete profession implementations.
  {
    files: ['js/games/gw2/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern)
    }
  },

  // Domain implementations receive services; simulation and isolated measurement are the two run composition owners.
  {
    files: ['js/games/gw2/platform/**/*.{ts,tsx}'],
    ignores: [
      'js/games/gw2/platform/index.ts',
      'js/games/gw2/platform/simulation/**',
      'js/games/gw2/platform/skill-damage/**'
    ],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern, simulationImplementationPattern)
    }
  },

  // Authoring schemas and profession declarations never acquire the mutable whole-run object, including through types.
  {
    files: ['js/games/gw2/platform/{skills,effects,events,profession-definition}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(
        sharedPlatformBoundaryPattern,
        simulationImplementationPattern,
        aggregateRuntimePattern
      )
    }
  },
  {
    files: ['js/games/gw2/platform/skill-damage/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern, {
        regex: '^#gw2/platform/profession-presentation/',
        message: 'Damage measurement owns its inputs; presentation consumes calculation contracts.'
      })
    }
  },
  // History is authoritative gameplay state and cannot require an optional report or output projection.
  {
    files: ['js/games/gw2/platform/combat/history/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern, simulationImplementationPattern, {
        regex: '^#gw2/platform/results/',
        message: 'Executed gameplay facts must be independent of result collection.'
      })
    }
  },

  // The runtime engine is phase-oriented. Keep implementation details from
  // crossing between execution/scheduling and resolution.
  {
    files: ['js/games/gw2/platform/execution/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern, simulationImplementationPattern, {
        regex: '(^|/)(resolution|resolver)(/|$)',
        message: 'Execution modules must communicate with resolution through shared contracts and events.'
      })
    }
  },
  {
    files: ['js/games/gw2/platform/resolver/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports(sharedPlatformBoundaryPattern, simulationImplementationPattern, {
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
