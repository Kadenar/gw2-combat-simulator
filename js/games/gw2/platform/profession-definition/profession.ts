import { applyAttributeContributions, attributeContext } from '#gw2/platform/attributes/evaluation.js';
import { attributeSeed } from '#gw2/platform/attributes/inputs.js';
import type {
  Gw2AttributeContext,
  Gw2AttributeContributionCalculator,
  Gw2AttributeContributions
} from '#gw2/platform/attributes/types.js';
import { normalizeProfessionBuild } from '#gw2/platform/builds/profession-build.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { EndurancePolicy, ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import { validateCatalogActionHandlers } from '#gw2/platform/effects/action-declarations.js';
import { validateAutoattackChainOptions } from '#gw2/platform/execution/autoattack-chains.js';
import {
  CAST_READY,
  combineAvailability,
  denyCast,
  selectedSlotSkillAvailability,
  weaponSetSwapAvailability
} from '#gw2/platform/execution/availability.js';
import { skillCostAvailability } from '#gw2/platform/execution/skill-cost.js';
import {
  assembleNativeRuntimeCatalog,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import {
  assertDefinition,
  assertModifierDefinition,
  defineProfession
} from '#gw2/platform/profession-definition/compile-contract.js';
import type { Gw2ProfessionContract } from '#gw2/platform/profession-definition/family-contract.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState
} from '#gw2/platform/profession-definition/module-types.js';
import type {
  ProfessionRuntimeOptions,
  RuntimeProfession
} from '#gw2/platform/profession-definition/runtime-contract.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { composePlanningState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, prepareTraitAttributes } from '#gw2/platform/profession-definition/traits.js';
import {
  assertTraitTrigger,
  compileProfessionRules,
  compileTriggerPoints,
  validateTriggerPoints
} from '#gw2/platform/profession-definition/trigger-rules.js';
import type {
  NormalizedProfessionContract,
  ProfessionConfig,
  ProfessionModifierDefinition
} from '#gw2/platform/profession-definition/types.js';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { nativeSkillModifierRules } from '#gw2/platform/skills/modifiers.js';
import { catalogSkillFields } from '#gw2/platform/skills/shared-fields.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/** Policies a family exposes for capacity previews; their maximum reads only configuration and catalog. */
type ProfessionResourcePreview = ResourcePolicies & { readonly endurance?: EndurancePolicy };

/** Every field a module shell may declare; `kind` is stamped by `defineNativeModule` itself. */
const NATIVE_MODULE_FIELDS = Object.freeze([
  'id',
  'kind',
  'data',
  'state',
  'modifiers',
  'hooks',
  'presentation',
  'traitDefinitions',
  'attributes',
  'canSwapWeaponSetsInCombat'
]);

/** Typed shells still reject an empty id and retired or misspelled sections that would otherwise install nothing. */
function assertNativeModuleDefinition(definition: {
  readonly id: string;
  readonly kind?: string;
  readonly state: object;
  readonly modifiers?: ProfessionModifierDefinition | readonly unknown[];
}): void {
  if (!definition.id.trim()) {
    throw new TypeError('Native profession module id is required.');
  }

  // Unknown fields would otherwise be dropped silently, leaving their behavior uninstalled.
  for (const key of Object.keys(definition)) {
    if (!NATIVE_MODULE_FIELDS.includes(key)) throw new TypeError(`Unsupported native module field: ${key}.`);
  }

  for (const key of Object.keys(definition.state)) {
    if (!['create', 'project'].includes(key)) throw new TypeError(`Unsupported native state field: ${key}.`);
  }

  // Authoring accepts rule arrays; registered modules and preview clones use one validated object shape.
  if (
    definition.kind === 'native-profession-module' ||
    (definition.modifiers != null && !Array.isArray(definition.modifiers))
  ) {
    assertModifierDefinition(definition.modifiers ?? {}, `${definition.id}.modifiers`);
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
  TState extends object,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  TPresentation extends object = object,
  TSkill extends Skill = Skill
>(
  definition: NativeModuleDefinition<TId, TState, TProjectOptions, TProjectedState, TPresentation, TSkill>
): NativeModule<TId, TState, TProjectOptions, TProjectedState, TPresentation, TSkill> {
  assertNativeModuleDefinition(definition);

  const traits = definition.traitDefinitions?.map(defineTrait<TSkill>) ?? [];
  const sourceModifiers: ProfessionModifierDefinition = Array.isArray(definition.modifiers)
    ? { modifierRules: definition.modifiers }
    : ((definition.modifiers as ProfessionModifierDefinition | undefined) ?? {});
  // Expand once at registration. Preview reconstruction consumes these views without reinstalling base declarations.
  // Gate trait modifiers here so their predicates only need to describe additional combat conditions.
  const traitRules = traits.flatMap((trait) =>
    (trait.modifierRules ?? []).map(({ requiresSelection = true, ...rule }) => ({
      ...rule,
      when: (context: Parameters<NonNullable<typeof rule.when>>[0]) =>
        (!requiresSelection || hasTrait(context, trait.id)) && (rule.when?.(context) ?? true)
    }))
  );
  const hooks = traits.length
    ? {
        ...composeRuntimeHooks<never, TSkill>([
          // Value policies and explicitly admitted lifetime work retain the trait's module position under isolation.
          ...traits.flatMap((trait) => {
            const initialize = trait.hooks?.initialize;
            const prepareEvent = trait.hooks?.prepareEvent;
            const modifyEffects = trait.hooks?.modifyEffects;
            const policies = {
              ...trait.hooks,
              // Value transforms receive observation capabilities only; admitted mutable work is declared separately.
              ...(prepareEvent
                ? {
                    prepareEvent: (
                      runtime: MechanicContext<never, TSkill>,
                      event: Parameters<typeof prepareEvent>[1]
                    ) => prepareEvent(runtime.queries, event)
                  }
                : {}),
              ...(modifyEffects
                ? {
                    modifyEffects: (
                      runtime: MechanicContext<never, TSkill>,
                      cast: Parameters<typeof modifyEffects>[1],
                      effects: Parameters<typeof modifyEffects>[2]
                    ) => modifyEffects(runtime.queries, cast, effects)
                  }
                : {}),
              ...(initialize
                ? {
                    // Supplied-state import cannot start effects, tasks, proc claims or resources through this context.
                    initialize: (runtime: MechanicContext<never, TSkill>) =>
                      initialize(
                        Object.freeze({
                          profession: runtime.profession,
                          config: runtime.config,
                          helpers: runtime.helpers,
                          traits: runtime.traits,
                          time: runtime.time
                        })
                      )
                  }
                : {})
            };
            // Traits without retained handlers add no callbacks to the per-event composition loops.
            return [...(trait.hooks ? [policies] : []), ...(trait.lifetime ? [trait.lifetime] : [])];
          }),
          definition.hooks ?? {}
        ]),
        traitTriggers: [
          ...(definition.hooks?.traitTriggers ?? []),
          ...traits.flatMap((trait) => (trait.triggers ?? []).map((rule) => ({ ...rule, trait: trait.id })))
        ],
        rechargeRules: [
          ...(definition.hooks?.rechargeRules ?? []),
          ...traits.flatMap((trait) => (trait.rechargeRules ?? []).map((rule) => ({ ...rule, trait: trait.id })))
        ]
      }
    : definition.hooks;
  // Skill rules are registered once alongside traits; runtime and authoring consume the same scoped declarations.
  const ownedRules = [...traitRules, ...nativeSkillModifierRules(definition.data)];
  return Object.freeze({
    ...definition,
    kind: 'native-profession-module' as const,
    ...(definition.traitDefinitions ? { traitDefinitions: Object.freeze(traits) } : {}),
    data: Object.freeze({ ...definition.data }),
    modifiers: ownedRules.length
      ? { ...sourceModifiers, modifierRules: [...(sourceModifiers.modifierRules ?? []), ...ownedRules] }
      : sourceModifiers,
    state: Object.freeze({ ...definition.state }),
    hooks: hooks ? Object.freeze({ ...hooks }) : undefined,
    presentation:
      typeof definition.presentation === 'function'
        ? definition.presentation
        : definition.presentation
          ? Object.freeze({ ...definition.presentation })
          : undefined
  });
}

/** Binds module presentation only when the application first requests its UI. */
function createModuleUi<TSkill extends Skill>(
  module: AnyNativeModule<string, TSkill>,
  applicationCatalog: Readonly<CanonicalCatalog<TSkill>>
): Partial<ProfessionUiContract> {
  const presentation =
    typeof module.presentation === 'function' ? module.presentation(applicationCatalog) : module.presentation;
  return { ...(presentation as Partial<ProfessionUiContract> | undefined) };
}

/** Merge declarations before normalization so every active rule shares one evaluator and each policy has one owner. */
function composeModuleModifiers(
  modules: readonly Pick<AnyNativeModule, 'id' | 'modifiers'>[]
): ProfessionModifierDefinition {
  const declarations = modules.flatMap((module) => module.modifiers.modifierRules ?? []);
  const damageBuckets: NonNullable<ProfessionModifierDefinition['damageBuckets']> = {};
  const policyOwners = new Map<string, string>();
  for (const module of modules) {
    const policies = module.modifiers.damageBuckets;

    if (policies == null) continue;

    for (const target of Object.keys(policies)) {
      if (policyOwners.has(target))
        throw new TypeError(
          `modifiers.damageBuckets.${target} has multiple owners: ${policyOwners.get(target)}, ${module.id}.`
        );

      policyOwners.set(target, module.id);
    }

    Object.assign(damageBuckets, policies);
  }

  return { modifierRules: declarations, damageBuckets };
}

/** Creates fresh Core/elite state while rejecting invalid fragments and conflicting field ownership. */
function composeStateFragments(
  modules: readonly Pick<AnyNativeModule, 'id' | 'state'>[],
  config: Readonly<ProfessionConfig>,
  preparation: Parameters<AnyNativeModule['state']['create']>[1]
): object {
  const fragments = modules.map((module) => {
    // Stateless modules return an empty object explicitly; invalid factories must not hide missing runtime state.
    const fragment = module.state.create(config, preparation);

    if (fragment === null || typeof fragment !== 'object' || Array.isArray(fragment)) {
      throw new TypeError(`${module.id} state factory must return an object.`);
    }

    return fragment;
  });
  const core = fragments[0];
  for (const [index, fragment] of fragments.entries()) {
    for (const property of Reflect.ownKeys(fragment)) {
      if (property === 'core' || property === 'specialization') {
        throw new TypeError(`${modules[index].id} state fragment uses reserved key ${property}.`);
      }

      if (index > 0 && Reflect.has(core, property)) {
        throw new TypeError(`Duplicate state field ${String(property)} in Core and ${modules[index].id}.`);
      }
    }
  }

  return { core, specialization: { kind: modules[1]?.id ?? 'Core', state: fragments[1] ?? {} } };
}

/** Compiles stable profession content while retaining its source definition for optional integration decorators. */
export function defineNativeProfession<
  const TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build,
  TSkill extends Skill = Skill
>(
  definition: NativeProfessionDefinition<TModules, TPresentation, TBuild, TSkill>
): NativeProfessionContract<TModules, TPresentation, TBuild, TSkill> {
  assertDefinition(definition);

  validateAutoattackChainOptions(definition.autoattackChains ?? {});
  // Module data fixes the skill type for both catalog selection and execution callbacks.
  const modules: readonly AnyNativeModule<string, TSkill>[] = definition.modules;
  for (const module of modules) assertNativeModuleDefinition(module);
  const assembly = getNativeCatalogAssembly(modules);
  // Ownership and declarative references are checked before lazy runtime compilation, including inactive elites.
  const traitOwners = new Set<string>();
  const ruleOwners = new Set<string>();
  for (const module of modules) {
    for (const trait of module.traitDefinitions ?? []) {
      if (traitOwners.has(String(trait.id))) throw new TypeError(`Duplicate trait definition ${trait.id}.`);

      traitOwners.add(String(trait.id));

      if (!module.data.traits?.some((entry) => String(entry.id) === String(trait.id)))
        throw new TypeError(`${module.id} trait definition ${trait.id} has no owned trait metadata.`);
    }

    const rules = module.modifiers.modifierRules ?? [];
    for (const rule of rules) {
      if (ruleOwners.has(rule.id)) throw new TypeError(`Duplicate modifier rule ${rule.id}.`);

      ruleOwners.add(rule.id);
    }

    // Reuse assembled profiles; Core rules cannot refer to inactive elite tuning.
    const profiles = new Map(
      [
        ...(assembly.fragments.get(modules[0].id)!.balanceProfiles ?? []),
        ...(assembly.fragments.get(module.id)!.balanceProfiles ?? [])
      ].map((profile) => [profile.id, profile])
    );
    for (const trigger of module.hooks?.traitTriggers ?? []) {
      assertTraitTrigger(trigger, `${module.id} trait ${trigger.trait}`);

      if (trigger.emit != null && !profiles.has(trigger.emit))
        throw new TypeError(`Unknown trait trigger profile ${trigger.emit} in ${module.id}.`);

      if (trigger.invoke != null && !assembly.catalog.skillsById.has(trigger.invoke))
        throw new TypeError(`Unknown trait trigger skill ${trigger.invoke} in ${module.id}.`);
    }

    for (const rule of module.hooks?.rechargeRules ?? [])
      if (typeof rule.multiplier === 'object') {
        // A skill reference is resolved against the skill selected by the rule at runtime.
        if ('skillField' in rule.multiplier) {
          if (
            typeof rule.multiplier.skillField !== 'string' ||
            !rule.multiplier.skillField.trim() ||
            Object.keys(rule.multiplier).length !== 1
          )
            throw new TypeError(`Invalid recharge skill reference in ${module.id}.`);

          // Predicates may depend on live state, but the reference must name a declared numeric skill field.
          const field = rule.multiplier.skillField;

          if (catalogSkillFields(assembly.catalog)[field]?.kind !== 'number')
            throw new TypeError(`Unknown recharge skill field=${field} in ${module.id}.`);

          continue;
        }

        const { profile, field } = rule.multiplier;

        if (typeof profiles.get(profile)?.[field] !== 'number')
          throw new TypeError(`Invalid recharge profile reference ${profile}.${field} in ${module.id}.`);
      }
  }

  // Order lists may name Core and elite traits, so completeness is proven across every module, selected or not.
  validateTriggerPoints(modules.flatMap((module) => module.hooks?.traitTriggers ?? []));

  const core = modules[0];
  const specializations = new Map(modules.slice(1).map((module) => [module.id, module]));
  const build = normalizeProfessionBuild(definition.id, definition.build);
  let presentation: ProfessionUiContract | undefined;
  type State = NativeProfessionRuntimeState<TModules>;
  // Registration removes traits without attribute work before each query selects its callbacks and retained grants.
  const attributeModules = modules.map((module) => ({
    id: module.id,
    attributes: module.attributes,
    traits: (module.traitDefinitions ?? []).filter((trait) => trait.attributes || trait.grantedAttributes)
  }));
  // A simulation query has fixed traits. Detached previews select afresh; live values are always evaluated anew.
  const selectedByQuery = new WeakMap<object, ReturnType<typeof selectAttributeModules>>();
  function selectAttributeModules(context: Gw2AttributeContext) {
    return attributeModules
      .map((module) => {
        const active = module.id === 'Core' || module.id === context.config?.specialization;
        const traits: Array<ReturnType<typeof prepareTraitAttributes>> = [];
        for (const trait of module.traits) {
          if (trait.attributes && hasTrait(context, trait.id))
            traits.push(prepareTraitAttributes(trait.attributes, context));

          if (active && trait.grantedAttributes) traits.push(trait.grantedAttributes);
        }

        return { attributes: active ? module.attributes : undefined, traits };
      })
      .filter((module) => module.attributes || module.traits.length);
  }

  // Every owner contributes once to both the panel and runtime; selection and patch resolution are shared.
  const calculateContributions: Gw2AttributeContributionCalculator = (context) => {
    let selected = context.query && selectedByQuery.get(context.query);

    if (!selected) {
      selected = selectAttributeModules(context);

      if (context.query) selectedByQuery.set(context.query, selected);
    }

    const contributions: Gw2AttributeContributions[] = [];
    for (const module of selected) {
      if (module.attributes) contributions.push(...module.attributes(context));

      // Constants are already resolved; only declarations with live inputs need another evaluation.
      for (const contribute of module.traits)
        contributions.push(typeof contribute === 'function' ? contribute(context) : contribute);
    }

    return contributions;
  };

  const selections = new Map<
    string,
    {
      modules: readonly AnyNativeModule<string, TSkill>[];
      source: Readonly<NormalizedProfessionContract<State, TSkill>>;
      runtimes: Map<boolean, RuntimeProfession<State, TSkill>>;
    }
  >();
  /** Query and execution share selected catalogs, state factories, and compiled modifiers. */
  function selectionFor(specialization: string) {
    const cached = selections.get(specialization);

    if (cached) return cached;

    const elite = specializations.get(specialization);

    if (specialization !== 'Core' && !elite) {
      throw new Error(
        `Unknown ${definition.name} elite specialization "${specialization}". Expected Core or one of: ${[...specializations.keys()].join(', ')}.`
      );
    }

    const selected = elite ? [core, elite] : [core];
    const projectors = selected.flatMap((module) =>
      module.state.project ? [module.state.project as (input: unknown) => object] : []
    );
    const catalog = assembleNativeRuntimeCatalog(selected.map((module) => assembly.fragments.get(module.id)!));
    const balanceContext = {
      catalog,
      modifierRulesById: new Map(
        selected.flatMap((module) => module.modifiers.modifierRules ?? []).map((rule) => [rule.id, rule])
      )
    };
    // Runtime owners build attribute facts once, directly against the selected patch's immutable balance context.
    const attributeBalanceContexts = new WeakMap<Readonly<CanonicalCatalog>, Gw2AttributeContext['balanceContext']>([
      [catalog, balanceContext]
    ]);
    const selectedContributions: NonNullable<NormalizedProfessionContract['attributeContributions']> = (input) => {
      let selectedBalance = attributeBalanceContexts.get(input.catalog);

      if (!selectedBalance) {
        selectedBalance = { ...balanceContext, catalog: input.catalog };
        attributeBalanceContexts.set(input.catalog, selectedBalance);
      }

      return calculateContributions(attributeContext(input, selectedBalance));
    };

    const source = defineProfession<State, TSkill>({
      id: definition.id,
      name: definition.name,
      attributeContributions: selectedContributions,
      canSwapWeaponSetsInCombat: elite?.canSwapWeaponSetsInCombat ?? core.canSwapWeaponSetsInCombat ?? true,
      weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
      catalog,
      resources: {
        createState: (config, selectedBalance = balanceContext) =>
          composeStateFragments(selected, config, {
            balanceContext: selectedBalance,
            attributes: applyAttributeContributions(
              attributeSeed(config),
              attributeSeed(config).commonTotals,
              calculateContributions(attributeContext({ config, time: 0 }, selectedBalance))
            )
          }) as State,
        ...(projectors.length
          ? {
              projectPlanningState: (input: unknown) =>
                composePlanningState(projectors.map((project) => project(input)))
            }
          : {})
      },
      modifiers: composeModuleModifiers(selected)
    });
    const selection: NonNullable<ReturnType<typeof selections.get>> = {
      modules: selected,
      source,
      runtimes: new Map()
    };
    selections.set(specialization, selection);
    return selection;
  }

  const resolveProfession = (config: Readonly<ProfessionConfig> = {}) =>
    selectionFor((config.specialization || 'Core').trim() || 'Core').source as Gw2ProfessionContract<State, TSkill>;
  /** Composes Core and the selected specialization's hooks over the resolved profession's catalog and modifiers. */
  function runtimeFor(
    config: Gw2Config,
    { traitTriggers = true }: ProfessionRuntimeOptions = {}
  ): RuntimeProfession<State, TSkill> {
    const specialization = config.specialization ?? 'Core';

    if (specialization !== 'Core' && !specializations.has(specialization))
      throw new TypeError(`Unknown specialization: ${specialization}.`);

    const selection = selectionFor(specialization);
    // Cache each hook composition separately so a preview cannot change subsequent combat registration.
    const cached = selection.runtimes.get(traitTriggers);

    if (cached) return cached;

    const { modules: selected, source } = selection;
    // Family bindings capture only the active contribution; runtime callbacks still query the selected live catalog.
    const hooks = [
      definition.runtimeHooks?.(specialization) ?? {},
      ...(selected.map((module) => module.hooks ?? {}) as RuntimeHooks<State, TSkill>[])
    ].map((hooks) => compileProfessionRules(hooks, { traitTriggers }));
    const composed = composeRuntimeHooks(hooks);
    const runtime: RuntimeProfession<State, TSkill> = {
      ...composed,
      triggerListeners: traitTriggers ? compileTriggerPoints(composed.traitTriggers ?? []) : new Map(),
      id: definition.id,
      canSwapWeaponSetsInCombat: source.canSwapWeaponSetsInCombat,
      catalog: source.catalog,
      skillSelectionCatalog: assembly.catalog,
      projectPlanningState: source.projectPlanningState,
      modifyAttributes: source.modifyAttributes,
      modifyConditionAttributes: source.modifyConditionAttributes,
      modifyCriticalChance: source.modifyCriticalChance,
      modifyCriticalDamage: source.modifyCriticalDamage,
      modifyStrikeDamage: source.modifyStrikeDamage,
      modifyConditionDamage: source.modifyConditionDamage,
      modifyConditionDuration: source.modifyConditionDuration,
      attributeContributions: source.attributeContributions,
      modifyConditionBaseDuration: source.modifyConditionBaseDuration,
      // Preview and simulation share the same validated Core/elite state composition.
      createState: source.createState,
      autoattackChainOverrides: definition.autoattackChains?.overrides,
      weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
      availability(context, skill, command) {
        const swap = weaponSetSwapAvailability(context, source.canSwapWeaponSetsInCombat, skill);

        if (swap) return swap;

        if (!isBuildSkillAvailable(skill, context.config))
          return denyCast('gw2.build-unavailable', `${skill.name} is unavailable for this build.`);

        if (definition.requireEquippedSlotSkills) {
          const slot = selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill);

          if (slot) return slot;
        }

        const cost = skillCostAvailability(context, skill);

        if (cost && !cost.ready && cost.retryAt == null) return cost;

        // Only retryable cost denials reach profession gates; arbitration retains their combined deadline.
        const result = composed.availability?.(context, skill, command) ?? CAST_READY;
        return combineAvailability(cost ?? CAST_READY, result, context.time);
      }
    };

    // Bind actions on base and profile effects after Core and elite handlers have been composed.
    validateCatalogActionHandlers(runtime.catalog, (type) => typeof runtime.sideEffectHandlers?.[type] === 'function');

    selection.runtimes.set(traitTriggers, runtime);
    return runtime;
  }

  // The native owner exposes application services directly, without translating another module or family shell.
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: assembly.catalog,
    nativeDefinition: Object.freeze({ ...definition }),
    attributeContributions: calculateContributions,
    ...build,
    resolveProfession,
    runtimeFor,
    get ui() {
      return (presentation ??= normalizeProfessionUi(
        definition.id,
        createProfessionFamilyUi({
          catalog: assembly.catalog,
          core: createModuleUi(core, assembly.catalog),
          specializations: Object.fromEntries(
            [...specializations].map(([name, module]) => [name, createModuleUi(module, assembly.catalog)])
          ),
          // Family and module factories stay lazy so headless compilation never initializes presentation.
          family:
            typeof definition.presentation === 'function'
              ? definition.presentation(assembly.catalog)
              : definition.presentation,
          // Capacity previews use live hook policies without creating state or starting gameplay tasks.
          resourcesFor(specialization) {
            const runtime = runtimeFor({ specialization });
            return {
              ...(runtime.resources as ProfessionResourcePreview),
              ...(runtime.endurance == null ? {} : { endurance: runtime.endurance })
            };
          }
        })
      ));
    }
  });
}
