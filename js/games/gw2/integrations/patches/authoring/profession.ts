import { defineProfessionFamily } from '../../../platform/engine/profession/family.js';
import type {
  CanonicalCatalog,
  ProfessionFamilyDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition,
  ProfessionUiContract,
  SchedulerConfig,
  SchedulerRecord
} from '../../../platform/engine/types.js';
import { getNativeCatalogAssembly } from './catalog.js';
import {
  CURRENT_PATCH_ID,
  applyBalanceProfilePatch,
  applyModifierRulePatch,
  applySkillPatch,
  balanceProfileAuthoringReference,
  balanceProfileHasAuthorableControls,
  balanceProfilePatchableNumericFields,
  patchRuntimeValuesFor,
  professionPatchFor,
  skillAuthoringReference,
  skillPatchableNumericFields,
  validatePatchOverview,
  validatePatchPreview
} from './patches.js';
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativePatchAuthoringMetadata,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState,
  NativePreviewModifierRuleTarget,
  NativeResolvedReaction,
  NativeResolverMechanic,
  NativeSchedulerMechanic
} from './module-types.js';
import type { ModifierRulePatchEdit, ProfessionPatchPreview } from './patches.js';
import type { Gw2ModifierRule } from '../../../platform/combat/modifiers/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '../../../platform/resolver/types.js';
import {
  createGw2AutoattackChainMechanics,
  type Gw2AutoattackChainOptions
} from '../../../platform/skills/autoattack-chains.js';

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNativeModuleDefinition(definition: object): void {
  assertObject(definition, 'Native profession module');
  const candidate = definition as {
    readonly id?: string;
    readonly data?: object;
    readonly state?: {
      readonly scheduler?: (...args: never[]) => object;
      readonly resolver?: (...args: never[]) => object;
      readonly project?: (...args: never[]) => object;
    };
    readonly mechanics?: {
      readonly availability?: NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
      readonly castLifecycle?: readonly NativeSchedulerMechanic[];
      readonly reactions?: readonly { readonly phase?: string }[];
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

  // availability can be a single mechanic or an array; normalize to array for uniform validation.
  const schedulerDeclarations = [
    ...(candidate.mechanics?.availability == null
      ? []
      : Array.isArray(candidate.mechanics.availability)
        ? candidate.mechanics.availability
        : [candidate.mechanics.availability]),
    ...(candidate.mechanics?.castLifecycle || [])
  ];
  for (const declaration of schedulerDeclarations) {
    if (declaration.phase !== 'scheduler' || typeof declaration.handler !== 'function') {
      throw new TypeError(`${candidate.id} contains an invalid scheduler mechanic declaration.`);
    }
  }

  for (const declaration of candidate.mechanics?.reactions || []) {
    if (declaration.phase !== 'resolver') {
      throw new TypeError(`${candidate.id} contains a non-resolver reaction declaration.`);
    }
  }
}

/** Declares a module without exposing engine normalization plumbing. */
export function defineNativeModule<
  const TId extends string,
  TSchedulerState extends object,
  TResolverState extends object = TSchedulerState,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  THandlerContext extends object = object,
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
  return Object.freeze({
    ...definition,
    kind: 'native-profession-module' as const,
    data: Object.freeze({ ...definition.data }),
    state: Object.freeze({ ...definition.state }),
    mechanics: definition.mechanics ? Object.freeze({ ...definition.mechanics }) : undefined,
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

function nativeModuleModifierRules(module: AnyNativeModule): readonly Gw2ModifierRule[] {
  const modifiers = module.mechanics?.modifiers;
  if (Array.isArray(modifiers)) {
    return modifiers as readonly Gw2ModifierRule[];
  }

  if (!modifiers || typeof modifiers !== 'object') return [];
  const rules = (modifiers as { readonly modifierRules?: unknown }).modifierRules;
  if (rules == null) return [];
  if (!Array.isArray(rules)) {
    throw new TypeError(`${module.id} modifierRules must be an array.`);
  }

  return rules as readonly Gw2ModifierRule[];
}

function modifierAuthoringValue(value: Gw2ModifierRule['amount'] | Gw2ModifierRule['factor']): {
  readonly kind: 'static' | 'resolver' | 'absent';
  readonly value?: number;
} {
  if (typeof value === 'number') {
    return Object.freeze({ kind: 'static', value });
  }

  return Object.freeze({
    kind: typeof value === 'function' ? 'resolver' : 'absent'
  });
}

function createPatchAuthoringMetadata(
  professionId: string,
  professionName: string,
  modules: readonly AnyNativeModule[],
  fragments: ReadonlyMap<string, Readonly<ProfessionModuleCatalogFragment>>
): NativePatchAuthoringMetadata {
  return Object.freeze({
    professionId,
    professionName,
    modules: Object.freeze(
      modules.map((module) => {
        const fragment = fragments.get(module.id)!;
        const authoringBalanceProfiles = (fragment.balanceProfiles || []).map((profile) =>
          Object.freeze({
            id: profile.id,
            name: profile.name,
            moduleId: module.id,
            profile: balanceProfileAuthoringReference(profile),
            patchableFields: balanceProfilePatchableNumericFields(profile)
          })
        );
        return Object.freeze({
          id: module.id,
          traits: Object.freeze([...(fragment.traits || [])]),
          skills: Object.freeze(
            (fragment.skills || [])
              .filter((skill) => skill.implemented !== false && skill.patchAuthoringExcluded !== true)
              .map((skill) =>
                Object.freeze({
                  id: skill.id,
                  name: skill.name,
                  moduleId: module.id,
                  skill: skillAuthoringReference(skill),
                  patchableFields: skillPatchableNumericFields(skill)
                })
              )
          ),
          balanceProfiles: Object.freeze(
            authoringBalanceProfiles.filter(
              (entry) =>
                entry.profile.profileKind !== 'skill-variant' && balanceProfileHasAuthorableControls(entry.profile)
            )
          ),
          skillVariants: Object.freeze(
            authoringBalanceProfiles.filter(
              (entry) =>
                entry.profile.profileKind === 'skill-variant' && balanceProfileHasAuthorableControls(entry.profile)
            )
          ),
          modifierRules: Object.freeze(
            nativeModuleModifierRules(module).map((rule) =>
              Object.freeze({
                id: rule.id,
                label: rule.label || null,
                moduleId: module.id,
                targets: Object.freeze(Array.isArray(rule.target) ? [...rule.target] : [rule.target]),
                operation: rule.operation,
                amount: modifierAuthoringValue(rule.amount),
                factor: modifierAuthoringValue(rule.factor),
                parameters: Object.freeze({ ...(rule.parameters || {}) }),
                conditional: typeof rule.when === 'function',
                order: Number(rule.order || 0)
              })
            )
          )
        });
      })
    )
  });
}

const PROFESSION_PATCH_FIELDS = new Set(['skills', 'balanceProfiles', 'modifierRules', 'constants', 'overview']);

function assertProfessionPatchShape(professionId: string, patch: ProfessionPatchPreview): void {
  assertObject(patch, `${professionId} patch`);
  for (const field of Object.keys(patch)) {
    if (!PROFESSION_PATCH_FIELDS.has(field)) {
      throw new TypeError(`${professionId} patch has unsupported field ${field}.`);
    }
  }

  for (const field of ['skills', 'balanceProfiles', 'modifierRules', 'constants'] as const) {
    if (patch[field] != null) {
      assertObject(patch[field], `${professionId} patch ${field}`);
    }
  }

  if (patch.overview != null && !Array.isArray(patch.overview)) {
    throw new TypeError(`${professionId} patch overview must be an array.`);
  }

  validatePatchOverview(patch.overview, `${professionId} patch overview`);
}

function modifierPatchFields(edit: ModifierRulePatchEdit): readonly string[] {
  return Object.freeze([
    ...(Object.hasOwn(edit, 'amount') ? ['amount'] : []),
    ...(Object.hasOwn(edit, 'factor') ? ['factor'] : []),
    ...Object.keys(edit.parameters || {}).map((name) => `parameters.${name}`)
  ]);
}

function preparePreviewModifierRules(
  modules: readonly AnyNativeModule[],
  patch: Readonly<Record<string, ModifierRulePatchEdit>> | null | undefined
): {
  readonly byModule: ReadonlyMap<string, readonly Gw2ModifierRule[]>;
  readonly targets: readonly NativePreviewModifierRuleTarget[];
} {
  const entries = Object.entries(patch || {});
  if (!entries.length) {
    return { byModule: new Map(), targets: Object.freeze([]) };
  }

  const declarations = modules.flatMap((module) => [...nativeModuleModifierRules(module)]);
  const patched = applyModifierRulePatch(declarations, patch);
  const patchedById = new Map(patched.map((rule) => [rule.id, rule]));
  const ownerById = new Map<string, string>();
  const byModule = new Map<string, readonly Gw2ModifierRule[]>();
  for (const module of modules) {
    const rules = nativeModuleModifierRules(module);
    if (!rules.length) continue;
    for (const rule of rules) ownerById.set(rule.id, module.id);
    byModule.set(module.id, Object.freeze(rules.map((rule) => patchedById.get(rule.id) || rule)));
  }

  const targets = entries.map(([id, edit]) =>
    Object.freeze({
      id,
      moduleId: ownerById.get(id)!,
      fields: modifierPatchFields(edit)
    })
  );
  return {
    byModule,
    targets: Object.freeze(targets)
  };
}

function compileNativeModule(
  module: AnyNativeModule,
  applicationCatalog: Readonly<CanonicalCatalog>,
  fragment: Readonly<ProfessionModuleCatalogFragment>,
  modifierRules?: readonly Gw2ModifierRule[],
  installAutoattackChainController = false,
  autoattackChainOptions: Gw2AutoattackChainOptions = {}
): ProfessionModuleDefinition {
  const mechanics = module.mechanics || {};
  const castRules = {
    ...((mechanics.castRules || {}) as SchedulerRecord)
  };
  const schedulerHooks: SchedulerRecord = {
    ...((mechanics.schedulerHooks || {}) as SchedulerRecord),
    ...(mechanics.skillMechanicHandlers == null ? {} : { skillMechanicHandlers: mechanics.skillMechanicHandlers })
  };
  // availability mechanics go into castRules (gate whether a skill can be cast);
  // castLifecycle mechanics go into schedulerHooks (run during and after cast).
  for (const declaration of [
    ...(mechanics.availability == null
      ? []
      : Array.isArray(mechanics.availability)
        ? mechanics.availability
        : [mechanics.availability]),
    ...((mechanics.castLifecycle || []) as NativeSchedulerMechanic[])
  ]) {
    appendOrderedHook(declaration.hook === 'availability' ? castRules : schedulerHooks, declaration.hook, declaration);
  }

  // Core receives the GW2-wide gate and committed-cast transition automatically;
  // specialization modules only contribute scoped configuration through the family.
  if (installAutoattackChainController) {
    const controller = createGw2AutoattackChainMechanics(autoattackChainOptions);
    appendOrderedHook(castRules, 'availability', controller.availability as NativeSchedulerMechanic);
    appendOrderedHook(schedulerHooks, 'afterCast', controller.castLifecycle as NativeSchedulerMechanic);
  }

  const resolverHooks = {
    ...((mechanics.resolverHooks || {}) as SchedulerRecord)
  };
  const reactions = {
    ...((resolverHooks.eventReactions || {}) as SchedulerRecord)
  };
  let requiresCriticalFacts = false;
  for (const declaration of (mechanics.reactions || []) as NativeResolvedReaction<
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

  // Resolved critical declarations consume the scheduler's canonical didCrit
  // fact, so enable sampling automatically instead of relying on each
  // profession initializer to request it independently.
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
  const modifiers = Array.isArray(mechanics.modifiers)
    ? { modifierRules: modifierRules || mechanics.modifiers }
    : modifierRules
      ? {
          ...((mechanics.modifiers || {}) as SchedulerRecord),
          modifierRules
        }
      : mechanics.modifiers;
  const presentation =
    typeof module.presentation === 'function' ? module.presentation(applicationCatalog) : module.presentation;
  return {
    id: module.id,
    catalog: fragment,
    resources: {
      createProfessionState: module.state.scheduler as (config: Readonly<SchedulerConfig>) => SchedulerRecord,
      // Resolver state defaults to the same factory as scheduler state so that
      // modules that don't need separate resolver state share one object.
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

/**
 * Compiles the native authoring contract into the existing engine family
 * boundary. Application and runtime catalogs are independently assembled from
 * the same module contributions.
 */
export function defineNativeProfession<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
>(definition: NativeProfessionDefinition<TModules, TPresentation, TSimulation>): NativeProfessionContract<TModules> {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('A native profession definition is required.');
  }

  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const preview = definition.patchPreview ? validatePatchPreview(definition.patchPreview) : null;
  const professionPatch = professionPatchFor(preview, definition.id);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const modifierRules = modules.flatMap((module) => [...nativeModuleModifierRules(module)]);
  const patchAuthoring = createPatchAuthoringMetadata(definition.id, definition.name, modules, assembly.fragments);
  const core = modules[0];
  const previewModifierRules = preparePreviewModifierRules(modules, professionPatch?.modifierRules);
  const createEngineDefinition = (
    modifierRulesByModule: ReadonlyMap<string, readonly Gw2ModifierRule[]> = new Map()
  ): ProfessionFamilyDefinition<NativeProfessionRuntimeState<TModules>> => ({
    id: definition.id,
    name: definition.name,
    catalog: assembly.catalog,
    build: definition.build,
    core: compileNativeModule(
      core,
      assembly.catalog,
      assembly.fragments.get('Core')!,
      modifierRulesByModule.get('Core'),
      true,
      definition.autoattackChains
    ),
    specializations: Object.fromEntries(
      modules
        .slice(1)
        .map((module) => [
          module.id,
          compileNativeModule(
            module,
            assembly.catalog,
            assembly.fragments.get(module.id)!,
            modifierRulesByModule.get(module.id)
          )
        ])
    ),
    ui: definition.presentation as Partial<ProfessionUiContract> | undefined,
    simulation: definition.simulation as SchedulerRecord | null | undefined
  });
  const family = defineProfessionFamily(createEngineDefinition());
  // previewFamily is lazily created only when there are modifier rule changes
  // in the patch — if only skill values changed, the baseline family is reused.
  let previewFamily: typeof family | null = null;
  const familyForPreview = () => {
    if (!previewModifierRules.targets.length) return family;
    previewFamily ||= defineProfessionFamily(createEngineDefinition(previewModifierRules.byModule));
    return previewFamily;
  };

  let previewCatalog: Readonly<CanonicalCatalog> | null = null;
  const validatedPreviewCatalog = (): Readonly<CanonicalCatalog> => {
    previewCatalog ||= applyBalanceProfilePatch(applySkillPatch(family.catalog, professionPatch), professionPatch);
    return previewCatalog;
  };

  // Cache patched runtime catalogs per original catalog object so we don't
  // re-apply the skill patch for every simulation that runs in preview mode.
  const runtimeCatalogs = new WeakMap<Readonly<CanonicalCatalog>, Readonly<CanonicalCatalog>>();
  const runtimeOverlays = new WeakMap<object, object>();
  const assertPatchId = (patchId = CURRENT_PATCH_ID): string => {
    if (patchId === CURRENT_PATCH_ID) return patchId;
    if (preview && patchId === preview.id) return patchId;
    throw new TypeError(
      `Unknown ${definition.name} patch ${patchId}. Expected ${CURRENT_PATCH_ID}` +
        (preview ? ` or ${preview.id}.` : '.')
    );
  };

  const catalogFor = (patchId = CURRENT_PATCH_ID): Readonly<CanonicalCatalog> => {
    if (assertPatchId(patchId) === CURRENT_PATCH_ID) return family.catalog;
    return validatedPreviewCatalog();
  };

  const patchValuesFor = (patchId = CURRENT_PATCH_ID) =>
    assertPatchId(patchId) === CURRENT_PATCH_ID ? Object.freeze({}) : patchRuntimeValuesFor(preview, definition.id);
  const validatePatch = (candidate: ProfessionPatchPreview | null | undefined): true => {
    if (!candidate) return true;
    assertProfessionPatchShape(definition.id, candidate);
    applySkillPatch(family.catalog, candidate);
    applyBalanceProfilePatch(family.catalog, candidate);
    applyModifierRulePatch(modifierRules, candidate.modifierRules);
    return true;
  };

  const resolveRuntime = (config: Readonly<SchedulerConfig> = {}) => {
    const patchId = assertPatchId(String(config.patchId || CURRENT_PATCH_ID));
    const runtime =
      patchId === CURRENT_PATCH_ID ? family.resolveRuntime(config) : familyForPreview().resolveRuntime(config);
    if (patchId === CURRENT_PATCH_ID) return runtime;
    validatedPreviewCatalog();
    const cachedRuntime = runtimeOverlays.get(runtime);
    if (cachedRuntime) return cachedRuntime as typeof runtime;
    const cached = runtimeCatalogs.get(runtime.catalog);
    const catalog =
      cached ||
      applyBalanceProfilePatch(
        applySkillPatch(runtime.catalog, professionPatch, {
          unknownSkills: 'ignore'
        }),
        professionPatch,
        { unknownProfiles: 'ignore' }
      );
    if (!cached) runtimeCatalogs.set(runtime.catalog, catalog);
    if (catalog === runtime.catalog) return runtime;
    const overlay = Object.freeze({ ...runtime, catalog });
    runtimeOverlays.set(runtime, overlay);
    return overlay;
  };

  return Object.freeze({
    ...family,
    preview,
    catalogFor,
    patchValuesFor,
    patchAuthoring,
    validatePatch,
    resolveRuntime,
    previewModifierRuleTargets: previewModifierRules.targets,
    specializationIds: Object.freeze(modules.slice(1).map((module) => module.id))
  }) as NativeProfessionContract<TModules>;
}
