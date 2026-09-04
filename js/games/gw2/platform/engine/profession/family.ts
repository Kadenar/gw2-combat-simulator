/**
 * Profession family assembly. Selects Core plus one specialization, composes
 * the executable runtime, and caches normalized contracts by specialization.
 */
import type {
  NormalizedProfessionContract,
  ProfessionDefinition,
  ProfessionFamilyContract,
  ProfessionFamilyDefinition,
  ProfessionModuleDefinition,
  ProfessionSource
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerConfig, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import {
  ATTRIBUTE_HOOK_NAMES,
  CAST_HOOK_NAMES,
  SCHEDULER_HOOK_NAMES,
  assertDefinition,
  defineProfession
} from '#gw2/platform/engine/profession/contract.js';
import {
  assertModuleDefinition,
  composeEventReactions,
  composeHookContainer,
  composeModuleCatalog,
  composeStateFragments,
  defineProfessionModule,
  mergeHandlerRegistries
} from '#gw2/platform/engine/profession/module.js';
import type { NamedModule } from '#gw2/platform/engine/profession/module.js';
import { composeModuleUi, createProfessionFamilyUi, singleOwnerValue } from '#gw2/platform/engine/profession/ui.js';

/**
 * Composes ordinary attribute hooks plus optional declarative rule fragments.
 * The compiler is single-owner (normally Core) so GW2 damage buckets are
 * compiled once after Core and active-specialization declarations are merged.
 */
function composeModuleAttributeRules(modules: readonly NamedModule<object>[]): SchedulerRecord {
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
    const hook = (compiled as SchedulerRecord)[name];
    if (hook == null) continue;
    result[name] = [...((result[name] as unknown[] | undefined) || []), hook];
  }

  return result;
}

function composeRuntimeDefinition<TProfessionState extends object>(
  definition: ProfessionFamilyDefinition<TProfessionState>,
  modules: readonly NamedModule[]
): ProfessionDefinition<TProfessionState> {
  const genericModules = modules as readonly NamedModule<object>[];
  const schedulerHooks = composeHookContainer(genericModules, 'schedulerHooks', SCHEDULER_HOOK_NAMES);
  schedulerHooks.taskHandlers = mergeHandlerRegistries(
    genericModules,
    (module) => module.schedulerHooks?.taskHandlers,
    'task handler'
  );
  schedulerHooks.skillMechanicHandlers = mergeHandlerRegistries(
    genericModules,
    (module) => module.schedulerHooks?.skillMechanicHandlers,
    'skill mechanic handler'
  );
  const eventHandlers = mergeHandlerRegistries(
    genericModules,
    (module) => module.resolverHooks?.eventHandlers,
    'event handler'
  );
  const projectEndState = singleOwnerValue(
    genericModules,
    (module) => module.resources?.projectEndState,
    'resources.projectEndState'
  );
  return {
    id: definition.id,
    name: definition.name,
    catalog: composeModuleCatalog(genericModules),
    build: definition.build,
    resources: {
      createProfessionState: (config) => composeStateFragments(genericModules, config, false) as TProfessionState,
      createResolverState: (config) => composeStateFragments(genericModules, config, true),
      ...(projectEndState == null ? {} : { projectEndState })
    },
    attributeRules: composeModuleAttributeRules(genericModules),
    castRules: composeHookContainer(genericModules, 'castRules', CAST_HOOK_NAMES),
    schedulerHooks,
    resolverHooks: {
      eventHandlers,
      eventReactions: composeEventReactions(genericModules)
    },
    ui: composeModuleUi(genericModules, definition.ui),
    simulation: definition.simulation
  };
}

/**
 * Creates a full application-facing profession catalog with a cached
 * core-plus-one-specialization simulation resolver.
 */
export function defineProfessionFamily<TProfessionState extends object = SchedulerRecord>(
  definition: ProfessionFamilyDefinition<TProfessionState>
): Readonly<ProfessionFamilyContract<TProfessionState>> {
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
  const applicationUi = createProfessionFamilyUi({
    catalog: definition.catalog,
    core: core.ui || {},
    specializations: Object.fromEntries([...specializationModules].map(([name, module]) => [name, module.ui || {}])),
    family: definition.ui
  });
  const applicationModules: NamedModule[] = [
    { name: 'Core', module: core },
    ...[...specializationModules].map(([name, module]) => ({ name, module }))
  ];
  // Reuse the ordinary application normalizers without constructing a
  // profession-wide executable runtime. The trigger registry is included only
  // so the full application catalog can validate every module-owned trigger.
  const applicationSurface = defineProfession({
    id: definition.id,
    name: definition.name,
    catalog: definition.catalog,
    build: definition.build,
    schedulerHooks: {
      skillMechanicHandlers: mergeHandlerRegistries(
        applicationModules,
        (module) => module.schedulerHooks?.skillMechanicHandlers,
        'skill mechanic handler'
      )
    },
    ui: applicationUi,
    simulation: definition.simulation
  });
  const cache = new Map<string, Readonly<NormalizedProfessionContract<TProfessionState>>>();
  const resolveRuntime = (
    config: Readonly<SchedulerConfig> = {}
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

    const runtime = defineProfession(composeRuntimeDefinition(definition, modules));
    cache.set(specialization, runtime);
    return runtime;
  };

  return Object.freeze({
    id: applicationSurface.id,
    name: applicationSurface.name,
    catalog: applicationSurface.catalog,
    ui: applicationSurface.ui,
    simulation: applicationSurface.simulation,
    createBuildDefaults: applicationSurface.createBuildDefaults,
    migrateBuild: applicationSurface.migrateBuild,
    validateBuild: applicationSurface.validateBuild,
    resolveRuntime
  }) as Readonly<ProfessionFamilyContract<TProfessionState>>;
}

/**
 * Resolves family contracts for the supplied configuration. Already-resolved
 * runtime contracts pass through unchanged.
 */
export function resolveProfessionRuntime<
  TProfessionState extends object = SchedulerRecord,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>
>(
  profession: ProfessionSource<TProfessionState, TRuntime>,
  config: Readonly<SchedulerConfig> = {}
): Readonly<TRuntime> {
  if (!profession || typeof profession !== 'object') {
    throw new TypeError('A profession contract is required.');
  }

  return typeof (profession as ProfessionFamilyContract<TProfessionState, TRuntime>).resolveRuntime === 'function'
    ? (profession as ProfessionFamilyContract<TProfessionState, TRuntime>).resolveRuntime(config)
    : (profession as Readonly<TRuntime>);
}
