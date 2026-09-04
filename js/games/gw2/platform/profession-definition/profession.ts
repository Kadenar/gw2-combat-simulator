import { defineProfessionFamily } from '#gw2/platform/engine/profession/family.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionFamilyDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition,
  ProfessionUiContract
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerConfig, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/catalog.js';
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState,
  NativeResolvedReaction,
  NativeResolverMechanic,
  NativeSchedulerMechanic
} from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import {
  createGw2AutoattackChainMechanics,
  type Gw2AutoattackChainOptions
} from '#gw2/platform/skills/autoattack-chains.js';

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNativeModuleDefinition(definition: object): void {
  assertObject(definition, 'Native profession module');
  const candidate = definition as {
    readonly id?: string;
    readonly data?: Record<string, unknown>;
    readonly state?: {
      readonly scheduler?: (...args: never[]) => object;
      readonly resolver?: (...args: never[]) => object;
      readonly project?: (...args: never[]) => object;
    };
    readonly mechanics?: {
      readonly execution?: {
        readonly skillHandlers?: unknown;
        readonly availability?: NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
        readonly castLifecycle?: readonly NativeSchedulerMechanic[];
        readonly castRules?: unknown;
        readonly hooks?: unknown;
        readonly skillMechanicHandlers?: unknown;
      };
      readonly resolution?: {
        readonly reactions?: readonly { readonly phase?: string }[];
        readonly hooks?: unknown;
      };
    };
  };
  if (!String(candidate.id || '').trim()) {
    throw new TypeError('Native profession module id is required.');
  }

  assertObject(candidate.data, `${candidate.id}.data`);
  assertObject(candidate.state, `${candidate.id}.state`);
  if (typeof candidate.state?.scheduler !== 'function') {
    throw new TypeError(`${candidate.id}.state.scheduler must be a function.`);
  }

  for (const name of ['resolver', 'project'] as const) {
    if (candidate.state?.[name] != null && typeof candidate.state[name] !== 'function') {
      throw new TypeError(`${candidate.id}.state.${name} must be a function.`);
    }
  }

  if (candidate.mechanics != null) {
    assertObject(candidate.mechanics, `${candidate.id}.mechanics`);
  }

  if (candidate.mechanics?.execution != null) {
    assertObject(candidate.mechanics.execution, `${candidate.id}.mechanics.execution`);
  }

  if (candidate.mechanics?.resolution != null) {
    assertObject(candidate.mechanics.resolution, `${candidate.id}.mechanics.resolution`);
  }

  const execution = candidate.mechanics?.execution;
  const resolution = candidate.mechanics?.resolution;
  // Availability can be singular or plural; normalize it before validating the shared declaration contract.
  const availability = execution?.availability;
  const castLifecycle = execution?.castLifecycle;
  const schedulerDeclarations = [
    ...(availability == null ? [] : Array.isArray(availability) ? availability : [availability]),
    ...(castLifecycle || [])
  ];
  for (const declaration of schedulerDeclarations) {
    if (declaration.phase !== 'scheduler' || typeof declaration.handler !== 'function') {
      throw new TypeError(`${candidate.id} contains an invalid scheduler mechanic declaration.`);
    }
  }

  for (const declaration of resolution?.reactions ?? []) {
    if (declaration.phase !== 'resolver') {
      throw new TypeError(`${candidate.id} contains a non-resolver reaction declaration.`);
    }
  }
}

/**
 * Declares a module without exposing engine normalization plumbing.
 *
 * Runtime immutability starts at composition, not at each content literal:
 * this boundary copies and freezes the module shell and its owned records,
 * catalog assembly normalizes and freezes catalog collections, and
 * `defineProfession` freezes the final engine contract. Values exported or
 * consumed before those boundaries must still protect their shared identity.
 */
export function defineNativeModule<
  const TId extends string,
  TSchedulerState extends object,
  TResolverState extends object = TSchedulerState,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  THandlerContext extends object = never,
  TModifierEscape extends object = object,
  TCastRulesEscape extends object = object,
  TSchedulerHooksEscape extends object = object,
  TResolverHooksEscape extends object = object,
  TReactions extends readonly NativeResolverMechanic[] = readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[] = readonly NativeSchedulerMechanic[],
  TPresentation extends object = object
>(
  definition: NativeModuleDefinition<
    TId,
    TSchedulerState,
    TResolverState,
    TProjectOptions,
    TProjectedState,
    THandlerContext,
    TModifierEscape,
    TCastRulesEscape,
    TSchedulerHooksEscape,
    TResolverHooksEscape,
    TReactions,
    TSchedulerMechanics,
    TPresentation
  >
): NativeModule<
  TId,
  TSchedulerState,
  TResolverState,
  TProjectOptions,
  TProjectedState,
  THandlerContext,
  TModifierEscape,
  TCastRulesEscape,
  TSchedulerHooksEscape,
  TResolverHooksEscape,
  TReactions,
  TSchedulerMechanics,
  TPresentation
> {
  assertNativeModuleDefinition(definition);
  const execution = definition.mechanics?.execution;
  return Object.freeze({
    ...definition,
    kind: 'native-profession-module' as const,
    data: Object.freeze({ ...definition.data }),
    state: Object.freeze({ ...definition.state }),
    mechanics: definition.mechanics
      ? Object.freeze({
          ...definition.mechanics,
          execution: execution ? Object.freeze({ ...execution }) : undefined,
          resolution: definition.mechanics.resolution
            ? Object.freeze({ ...definition.mechanics.resolution })
            : undefined
        })
      : undefined,
    presentation:
      typeof definition.presentation === 'function'
        ? definition.presentation
        : definition.presentation
          ? Object.freeze({ ...definition.presentation })
          : undefined
  });
}

function appendOrderedHook(target: SchedulerRecord, name: string, declaration: NativeSchedulerMechanic): void {
  const existing = target[name];
  target[name] = [
    ...(existing == null ? [] : Array.isArray(existing) ? existing : [existing]),
    {
      id: declaration.id,
      order: declaration.order,
      handler: declaration.handler
    }
  ];
}

function compileNativeModule(
  module: AnyNativeModule,
  applicationCatalog: Readonly<CanonicalCatalog>,
  fragment: Readonly<ProfessionModuleCatalogFragment>,
  installAutoattackChainController = false,
  autoattackChainOptions: Gw2AutoattackChainOptions = {}
): ProfessionModuleDefinition {
  const mechanics = module.mechanics || {};
  const execution = mechanics.execution || {};
  const resolution = mechanics.resolution || {};
  const castRules = { ...((execution.castRules || {}) as SchedulerRecord) };
  const schedulerHooks: SchedulerRecord = {
    ...((execution.hooks || {}) as SchedulerRecord),
    ...(execution.skillMechanicHandlers == null ? {} : { skillMechanicHandlers: execution.skillMechanicHandlers })
  };
  const availability = execution.availability;
  const availabilityDeclarations: readonly NativeSchedulerMechanic[] =
    availability == null ? [] : Array.isArray(availability) ? availability : [availability as NativeSchedulerMechanic];
  // Availability gates casts; lifecycle mechanics execute only after the corresponding cast transition.
  for (const declaration of [
    ...availabilityDeclarations,
    ...((execution.castLifecycle || []) as NativeSchedulerMechanic[])
  ]) {
    appendOrderedHook(declaration.hook === 'availability' ? castRules : schedulerHooks, declaration.hook, declaration);
  }

  // Core owns the shared chain controller; specialization modules only add scoped behavior.
  if (installAutoattackChainController) {
    const controller = createGw2AutoattackChainMechanics(autoattackChainOptions);
    appendOrderedHook(castRules, 'availability', controller.availability as NativeSchedulerMechanic);
    appendOrderedHook(schedulerHooks, 'afterCast', controller.castLifecycle as NativeSchedulerMechanic);
  }

  const resolverHooks = { ...((resolution.hooks || {}) as SchedulerRecord) };
  const reactions = {
    ...((resolverHooks.eventReactions || {}) as SchedulerRecord)
  };
  let requiresCriticalFacts = false;
  for (const declaration of (resolution.reactions || []) as NativeResolvedReaction<
    Gw2ResolverRuntime,
    Gw2ResolverEvent,
    object
  >[]) {
    requiresCriticalFacts ||= declaration.requiresCriticalFacts === true;
    const existing = reactions[declaration.stage];
    reactions[declaration.stage] = [
      ...(existing == null ? [] : Array.isArray(existing) ? existing : [existing]),
      {
        id: declaration.id,
        order: declaration.order,
        handler: declaration.handler
      }
    ];
  }

  // Critical-hit reactions require the scheduler to materialize canonical critical facts first.
  if (requiresCriticalFacts) {
    const initialize = schedulerHooks.initialize;
    schedulerHooks.initialize = [
      ...(initialize == null ? [] : Array.isArray(initialize) ? initialize : [initialize]),
      {
        id: `${module.id}.resolved-critical-facts`,
        order: -1000,
        handler(context: SchedulerRecord) {
          const policy = context.schedulerPolicy as { requireCriticalFacts?: () => void } | undefined;
          policy?.requireCriticalFacts?.();
        }
      }
    ];
  }

  resolverHooks.eventReactions = reactions;
  const modifiers = Array.isArray(mechanics.modifiers) ? { modifierRules: mechanics.modifiers } : mechanics.modifiers;
  const presentation =
    typeof module.presentation === 'function' ? module.presentation(applicationCatalog) : module.presentation;
  return {
    id: module.id,
    catalog: fragment,
    resources: {
      createProfessionState: module.state.scheduler as (config: Readonly<SchedulerConfig>) => SchedulerRecord,
      // Resolver state defaults to the scheduler state so simple modules share one state object.
      createResolverState: module.state.resolver || module.state.scheduler,
      ...(module.state.project == null ? {} : { projectEndState: module.state.project })
    },
    attributeRules: modifiers as SchedulerRecord | undefined,
    castRules,
    schedulerHooks,
    resolverHooks,
    ui: presentation as Partial<ProfessionUiContract> | undefined
  };
}

/** Compiles stable profession content while retaining its source definition for optional integration decorators. */
export function defineNativeProfession<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
>(
  definition: NativeProfessionDefinition<TModules, TPresentation, TSimulation>
): NativeProfessionContract<TModules, TPresentation, TSimulation> {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('A native profession definition is required.');
  }

  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const core = modules[0];
  const engineDefinition: ProfessionFamilyDefinition<NativeProfessionRuntimeState<TModules>> = {
    id: definition.id,
    name: definition.name,
    catalog: assembly.catalog,
    build: definition.build,
    core: compileNativeModule(
      core,
      assembly.catalog,
      assembly.fragments.get('Core')!,
      true,
      definition.autoattackChains
    ),
    specializations: Object.fromEntries(
      modules
        .slice(1)
        .map((module) => [module.id, compileNativeModule(module, assembly.catalog, assembly.fragments.get(module.id)!)])
    ),
    ui: definition.presentation as Partial<ProfessionUiContract> | undefined,
    simulation: definition.simulation as SchedulerRecord | null | undefined
  };
  const family = defineProfessionFamily(engineDefinition);

  return Object.freeze({
    ...family,
    nativeDefinition: Object.freeze({ ...definition }),
    specializationIds: Object.freeze(modules.slice(1).map((module) => module.id))
  }) as NativeProfessionContract<TModules, TPresentation, TSimulation>;
}
