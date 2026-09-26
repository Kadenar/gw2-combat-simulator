import { resourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import { normalizeProfessionBuild } from '#gw2/platform/builds/profession-contract.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
/**
 * Profession family assembly. Selects Core plus one specialization, composes
 * the executable runtime, and caches normalized contracts by specialization.
 */
import type {
  NormalizedProfessionContract,
  ProfessionDefinition,
  ProfessionAttributeRuleDefinition,
  ProfessionFamilyContract,
  ProfessionFamilyDefinition,
  ProfessionModuleDefinition,
  ProfessionSource
} from '#gw2/platform/engine/profession/types.js';
import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import { ATTRIBUTE_HOOK_NAMES, assertDefinition, defineProfession } from '#gw2/platform/engine/profession/contract.js';
import {
  assertModuleDefinition,
  composeHookContainer,
  composeModuleCatalog,
  composeStateFragments,
  defineProfessionModule,
  singleOwnerValue
} from '#gw2/platform/engine/profession/module.js';
import type { NamedModule } from '#gw2/platform/engine/profession/module.js';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';

/**
 * Composes ordinary attribute hooks plus optional declarative rule fragments.
 * The compiler is single-owner (normally Core) so GW2 damage buckets are
 * compiled once after Core and active-specialization declarations are merged.
 */
function composeModuleAttributeRules(modules: readonly NamedModule<object>[]): ProfessionAttributeRuleDefinition {
  const result = composeHookContainer(modules, 'attributeRules', ATTRIBUTE_HOOK_NAMES);
  const declarations = modules.flatMap((entry) => {
    const value = entry.module.attributeRules?.modifierRules;
    if (value == null) return [];
    if (!Array.isArray(value)) {
      throw new TypeError(`${entry.name} attributeRules.modifierRules must be an array.`);
    }

    return value;
  });
  const compiler = singleOwnerValue(
    modules,
    (module) => module.attributeRules?.compileModifierRules,
    'attributeRules.compileModifierRules'
  );
  if (!declarations.length) return result;
  if (typeof compiler !== 'function') {
    throw new TypeError('Attribute modifier-rule fragments require one compiler.');
  }

  const compiled = compiler(declarations);
  if (!compiled || typeof compiled !== 'object' || Array.isArray(compiled)) {
    throw new TypeError('attributeRules.compileModifierRules must return a hook object.');
  }

  for (const name of ATTRIBUTE_HOOK_NAMES) {
    const hook = compiled[name];
    if (hook == null) continue;
    result[name] = [...(result[name] || []), hook];
  }

  return result;
}

function composeRuntimeDefinition<TProfessionState extends object, TBuild extends object>(
  definition: ProfessionFamilyDefinition<TBuild>,
  modules: readonly NamedModule[]
): ProfessionDefinition<TProfessionState, TBuild> {
  const genericModules = modules as readonly NamedModule<object>[];
  const projectPlanningState = singleOwnerValue(
    genericModules,
    (module) => module.resources?.projectPlanningState,
    'resources.projectPlanningState'
  );
  return {
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: composeModuleCatalog(genericModules),
    resources: {
      ...Object.assign({}, ...genericModules.map(({ module }) => resourcePolicies(module.resources || {}))),
      // The selected elite replaces Core's policy as one capability; grants are never composed twice.
      endurance: [...genericModules].reverse().find(({ module }) => module.resources?.endurance)?.module.resources
        ?.endurance,
      createState: (config) => composeStateFragments(genericModules, config) as TProfessionState,
      ...(projectPlanningState == null ? {} : { projectPlanningState })
    },
    attributeRules: composeModuleAttributeRules(genericModules)
  };
}

/**
 * Creates a full application-facing profession catalog with a cached
 * core-plus-one-specialization simulation resolver.
 */
export function defineProfessionFamily<TProfessionState extends object = object, TBuild extends object = object>(
  definition: ProfessionFamilyDefinition<TBuild>
): Readonly<ProfessionFamilyContract<TProfessionState, NormalizedProfessionContract<TProfessionState>, TBuild>> {
  assertDefinition(definition);
  assertModuleDefinition(definition.core);
  if (definition.core.id !== 'Core') {
    throw new TypeError('The core profession module id must be "Core".');
  }

  if (
    !definition.specializations ||
    typeof definition.specializations !== 'object' ||
    Array.isArray(definition.specializations)
  ) {
    throw new TypeError('Profession family specializations must be an object.');
  }

  const specializationModules = new Map<string, Readonly<ProfessionModuleDefinition>>();
  for (const [name, module] of Object.entries(definition.specializations)) {
    assertModuleDefinition(module);
    if (name !== module.id) {
      throw new TypeError(`Specialization key ${name} does not match module id ${module.id}.`);
    }

    specializationModules.set(name, defineProfessionModule(module));
  }

  const core = defineProfessionModule(definition.core);
  // Validate the family catalog and simulation policy without composing executable hooks across inactive elites.
  // The trigger registry lets the full application catalog validate every module-owned trigger.
  const applicationSurface = defineProfession({
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: definition.catalog
  });
  const cache = new Map<string, Readonly<NormalizedProfessionContract<TProfessionState>>>();
  const resolveRuntime = (
    config: Readonly<ProfessionConfig> = {}
  ): Readonly<NormalizedProfessionContract<TProfessionState>> => {
    const specialization = String(config.specialization || 'Core').trim() || 'Core';
    if (specialization !== 'Core' && !specializationModules.has(specialization)) {
      throw new Error(
        `Unknown ${definition.name} elite specialization "${specialization}". ` +
          `Expected Core or one of: ${[...specializationModules.keys()].join(', ')}.`
      );
    }

    const cached = cache.get(specialization);
    if (cached) return cached;
    const modules: NamedModule[] = [{ name: 'Core', module: core }];
    const specializationModule = specializationModules.get(specialization);
    if (specializationModule) {
      modules.push({ name: specialization, module: specializationModule });
    }

    const runtime = defineProfession(composeRuntimeDefinition<TProfessionState, TBuild>(definition, modules));
    cache.set(specialization, runtime);
    return runtime;
  };

  const build = normalizeProfessionBuild(definition.id, definition.build);
  let presentation: ReturnType<typeof normalizeProfessionUi> | undefined;
  return Object.freeze({
    id: applicationSurface.id,
    name: applicationSurface.name,
    weaponSkillMatchesSet: applicationSurface.weaponSkillMatchesSet,
    catalog: applicationSurface.catalog,
    get ui() {
      return (presentation ??= normalizeProfessionUi(
        definition.id,
        createProfessionFamilyUi({
          resourcesFor: (specialization) => ({
            ...resourcePolicies(resolveRuntime({ specialization }).resources),
            endurance: resolveRuntime({ specialization }).resources.endurance ?? undefined,
            // Live-owned policies replace composed module declarations for the same resource.
            ...definition.resourcesFor?.(specialization)
          }),
          catalog: definition.catalog,
          core: core.ui || {},
          specializations: Object.fromEntries(
            [...specializationModules].map(([name, module]) => [name, module.ui || {}])
          ),
          family: definition.ui
        })
      ));
    },
    ...build,
    resolveRuntime
  }) as Readonly<ProfessionFamilyContract<TProfessionState, NormalizedProfessionContract<TProfessionState>, TBuild>>;
}

/**
 * Resolves family contracts for the supplied configuration. Already-resolved
 * runtime contracts pass through unchanged.
 */
export function resolveProfessionRuntime<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>
>(
  profession: ProfessionSource<TProfessionState, TRuntime>,
  config: Readonly<ProfessionConfig> = {}
): Readonly<TRuntime> {
  if (!profession || typeof profession !== 'object') {
    throw new TypeError('A profession contract is required.');
  }

  return typeof (profession as ProfessionFamilyContract<TProfessionState, TRuntime>).resolveRuntime === 'function'
    ? (profession as ProfessionFamilyContract<TProfessionState, TRuntime>).resolveRuntime(config)
    : (profession as Readonly<TRuntime>);
}
