import type { Skill } from '#gw2/platform/engine/skills/types.js';

import { normalizeProfessionBuild } from '#gw2/platform/builds/profession-contract.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/skill-eligibility.js';
import type { Gw2Build, Gw2TraitBuildAttributeCalculator } from '#gw2/platform/builds/types.js';
import { compileGw2ModifierRules } from '#gw2/platform/combat/modifiers.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import { MODIFIER_HOOK_NAMES, assertDefinition, defineProfession } from '#gw2/platform/engine/profession/contract.js';
import type {
  NormalizedProfessionContract,
  ProfessionHook,
  ProfessionModifierDefinition
} from '#gw2/platform/engine/profession/types.js';
import { denyCast, selectedSlotSkillAvailability } from '#gw2/platform/engine/skills/availability.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ProfessionContract } from '#gw2/platform/simulation/types.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { skillCostAvailability } from '#gw2/platform/execution/skill-cost.js';
import {
  assembleNativeRuntimeCatalog,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState
} from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { validateAutoattackChainOptions } from '#gw2/platform/skills/autoattack-chain-controller.js';

/** Policies a family exposes for capacity previews; their maximum reads only configuration and catalog. */
type ProfessionResourcePreview = ResourcePolicies & { readonly endurance?: EndurancePolicy };

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

/** Every field a module shell may declare; `kind` is stamped by `defineNativeModule` itself. */
const NATIVE_MODULE_FIELDS = Object.freeze([
  'id',
  'kind',
  'data',
  'state',
  'modifiers',
  'hooks',
  'presentation',
  'traitDefinitions'
]);

function assertNativeModuleDefinition(definition: object): void {
  assertObject(definition, 'Native profession module');
  const candidate = definition as {
    readonly id?: string;
    readonly data?: Record<string, unknown>;
    readonly state?: {
      readonly create?: (...args: never[]) => object;
      readonly project?: (...args: never[]) => object;
    };
    readonly hooks?: object;
  };
  if (!(candidate.id || '').trim()) {
    throw new TypeError('Native profession module id is required.');
  }

  // Unknown fields would otherwise be dropped silently, leaving their behavior uninstalled.
  for (const key of Object.keys(candidate)) {
    if (!NATIVE_MODULE_FIELDS.includes(key)) throw new TypeError(`Unsupported native module field: ${key}.`);
  }

  assertObject(candidate.data, `${candidate.id}.data`);
  assertObject(candidate.state, `${candidate.id}.state`);
  for (const key of Object.keys(candidate.state!)) {
    if (!['create', 'project'].includes(key)) throw new TypeError(`Unsupported native state field: ${key}.`);
  }

  if (typeof candidate.state?.create !== 'function') {
    throw new TypeError(`${candidate.id}.state.create must be a function.`);
  }

  for (const name of ['project'] as const) {
    if (candidate.state?.[name] != null && typeof candidate.state[name] !== 'function') {
      throw new TypeError(`${candidate.id}.state.${name} must be a function.`);
    }
  }

  if (candidate.hooks != null) {
    assertObject(candidate.hooks, `${candidate.id}.hooks`);
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
  TModifiers extends ProfessionModifierDefinition = object,
  TPresentation extends object = object
>(
  definition: NativeModuleDefinition<TId, TState, TProjectOptions, TProjectedState, TModifiers, TPresentation>
): NativeModule<TId, TState, TProjectOptions, TProjectedState, TModifiers, TPresentation> {
  assertNativeModuleDefinition(definition);
  if (definition.traitDefinitions != null && !Array.isArray(definition.traitDefinitions))
    throw new TypeError(`${definition.id}.traitDefinitions must be an array.`);
  const traits = definition.traitDefinitions?.map(defineTrait) ?? [];
  const sourceModifiers: ProfessionModifierDefinition = Array.isArray(definition.modifiers)
    ? { modifierRules: definition.modifiers }
    : ((definition.modifiers as ProfessionModifierDefinition | undefined) ?? {});
  // Expand once at registration. Preview reconstruction consumes these views without reinstalling base declarations.
  const traitRules = traits.flatMap((trait) =>
    (trait.modifierRules ?? []).map(({ requiresSelection = true, ...rule }) => ({
      ...rule,
      when: (context: Parameters<NonNullable<typeof rule.when>>[0]) =>
        (!requiresSelection || hasTrait(context, trait.id)) && (rule.when?.(context) ?? true)
    }))
  );
  const hooks = traits.length
    ? {
        ...composeRuntimeHooks<never>([
          ...traits.flatMap((trait) => (trait.hooks ? [trait.hooks] : [])),
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
  return Object.freeze({
    ...definition,
    kind: 'native-profession-module' as const,
    ...(definition.traitDefinitions ? { traitDefinitions: Object.freeze(traits) } : {}),
    data: Object.freeze({
      ...definition.data,
      ...(traits.length
        ? {
            balanceProfiles: Object.freeze([
              ...(definition.data.balanceProfiles ?? []),
              ...traits.flatMap((trait) => [
                ...(trait.balance ? [defineTraitProfile(trait.balance.id ?? trait.id, trait.name, trait.balance)] : []),
                ...(trait.profiles ?? [])
              ])
            ])
          }
        : {})
    }),
    modifiers: traitRules.length
      ? { ...sourceModifiers, modifierRules: [...(sourceModifiers.modifierRules ?? []), ...traitRules] }
      : definition.modifiers,
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
function createModuleUi(
  module: AnyNativeModule,
  applicationCatalog: Readonly<CanonicalCatalog>
): Partial<ProfessionUiContract> {
  const presentation =
    typeof module.presentation === 'function' ? module.presentation(applicationCatalog) : module.presentation;
  const ui = { ...(presentation as Partial<ProfessionUiContract> | undefined) };
  if (module.id === 'Core') {
    const paletteAvailability = ui.paletteSkillAvailability;
    // Resolve preview selection once so the availability gate and profession callback use the same specialization.
    ui.paletteSkillAvailability = (context, skill) => {
      const config = context.config;
      const build = context.build as { readonly specialization?: string } | undefined;
      const specialization =
        context.specialization || config?.specialization || build?.specialization || skill.specialization || 'Core';
      return isBuildSkillAvailable(skill, { specialization })
        ? (paletteAvailability?.({ ...context, specialization }, skill) ?? { available: true, message: '' })
        : { available: false, message: `${skill.name} is unavailable for this build.` };
    };
  }

  return ui;
}

/** Compiles merged active rules once, using standard GW2 buckets unless a module owns a custom compiler. */
function composeModuleModifiers(modules: readonly AnyNativeModule[]): ProfessionModifierDefinition {
  const modifiers = modules.map((module): ProfessionModifierDefinition =>
    Array.isArray(module.modifiers)
      ? { modifierRules: module.modifiers }
      : ((module.modifiers as ProfessionModifierDefinition | undefined) ?? {})
  );
  const result = Object.fromEntries(
    MODIFIER_HOOK_NAMES.map((name) => [
      name,
      modifiers.flatMap((source) => {
        const value = source[name];
        return (value == null ? [] : Array.isArray(value) ? value : [value]) as ProfessionHook[];
      })
    ])
  ) as Record<(typeof MODIFIER_HOOK_NAMES)[number], ProfessionHook[]>;
  const declarations = modifiers.flatMap((source, index) => {
    const value = source.modifierRules;
    if (value == null) return [];
    if (!Array.isArray(value)) throw new TypeError(`${modules[index].id} modifiers.modifierRules must be an array.`);
    return value;
  });
  const owners = modifiers.flatMap((source, index) => (source.compileModifierRules == null ? [] : [index]));
  if (owners.length > 1) {
    throw new TypeError(
      `modifiers.compileModifierRules has multiple owners: ${owners.map((index) => modules[index].id).join(', ')}.`
    );
  }

  if (!declarations.length) return result;
  const compiler: NonNullable<ProfessionModifierDefinition['compileModifierRules']> =
    modifiers[owners[0]]?.compileModifierRules ?? compileGw2ModifierRules;
  if (typeof compiler !== 'function') throw new TypeError('modifiers.compileModifierRules must be a function.');
  const compiled = compiler(declarations);
  if (!compiled || typeof compiled !== 'object' || Array.isArray(compiled)) {
    throw new TypeError('modifiers.compileModifierRules must return a hook object.');
  }

  for (const name of MODIFIER_HOOK_NAMES) {
    const hook = compiled[name];
    if (hook != null) result[name].push(hook);
  }

  return result;
}

/** Creates fresh Core/elite state while rejecting invalid fragments and conflicting field ownership. */
function composeStateFragments(modules: readonly AnyNativeModule[], config: Readonly<ProfessionConfig>): object {
  const fragments = modules.map((module) => {
    const fragment = module.state.create(config) || {};
    if (typeof fragment !== 'object' || Array.isArray(fragment)) {
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
  TBuild extends Gw2Build = Gw2Build
>(
  definition: NativeProfessionDefinition<TModules, TPresentation, TBuild>
): NativeProfessionContract<TModules, TPresentation, TBuild> {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('A native profession definition is required.');
  }

  assertDefinition(definition);
  validateAutoattackChainOptions(definition.autoattackChains ?? {});
  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
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

    const rules = Array.isArray(module.modifiers)
      ? module.modifiers
      : ((module.modifiers as ProfessionModifierDefinition | undefined)?.modifierRules ?? []);
    for (const rule of rules) {
      if (ruleOwners.has(rule.id)) throw new TypeError(`Duplicate modifier rule ${rule.id}.`);
      ruleOwners.add(rule.id);
    }

    // A Core rule cannot refer to an inactive elite profile; elite rules may use Core contributions.
    const profiles = new Map(
      [...(modules[0].data.balanceProfiles ?? []), ...(module.data.balanceProfiles ?? [])].map((profile) => [
        profile.id,
        profile
      ])
    );
    for (const trigger of module.hooks?.traitTriggers ?? [])
      if (!profiles.has(trigger.emit))
        throw new TypeError(`Unknown trait trigger profile ${trigger.emit} in ${module.id}.`);
    for (const rule of module.hooks?.rechargeRules ?? [])
      if (typeof rule.multiplier === 'object') {
        const { profile, field } = rule.multiplier;
        if (typeof profiles.get(profile)?.[field] !== 'number')
          throw new TypeError(`Invalid recharge profile reference ${profile}.${field} in ${module.id}.`);
      }
  }

  const core = modules[0];
  const specializations = new Map(modules.slice(1).map((module) => [module.id, module]));
  const build = normalizeProfessionBuild(definition.id, definition.build);
  // Family controls bind independently of lazy module presentation.
  const familyUi =
    typeof definition.presentation === 'function' ? definition.presentation(assembly.catalog) : definition.presentation;
  let presentation: ProfessionUiContract | undefined;
  type State = NativeProfessionRuntimeState<TModules>;
  const selections = new Map<
    string,
    {
      modules: readonly AnyNativeModule[];
      source: Readonly<NormalizedProfessionContract<State>>;
      runtime?: RuntimeProfession<State>;
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
    const source = defineProfession<State>({
      id: definition.id,
      name: definition.name,
      weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
      catalog: assembleNativeRuntimeCatalog(selected.map((module) => assembly.fragments.get(module.id)!)),
      resources: {
        createState: (config) => composeStateFragments(selected, config) as State,
        ...(projectors.length
          ? {
              projectPlanningState: (input: unknown) =>
                Object.assign({}, ...projectors.map((project) => project(input)))
            }
          : {})
      },
      modifiers: composeModuleModifiers(selected)
    });
    const selection: NonNullable<ReturnType<typeof selections.get>> = { modules: selected, source };
    selections.set(specialization, selection);
    return selection;
  }

  const resolveProfession = (config: Readonly<ProfessionConfig> = {}) =>
    selectionFor((config.specialization || 'Core').trim() || 'Core').source as Gw2ProfessionContract<State>;
  /** Composes Core and the selected specialization's hooks over the resolved profession's catalog and modifiers. */
  function runtimeFor(config: Gw2Config): RuntimeProfession<State> {
    const specialization = config.specialization ?? 'Core';
    if (specialization !== 'Core' && !specializations.has(specialization))
      throw new TypeError(`Unknown specialization: ${specialization}.`);
    const selection = selectionFor(specialization);
    if (selection.runtime) return selection.runtime;
    const { modules: selected, source } = selection;
    const hooks = (selected.map((module) => module.hooks ?? {}) as Partial<RuntimeProfession<State>>[]).map(
      compileProfessionRules
    );
    const composed = composeRuntimeHooks(hooks);
    const runtime: RuntimeProfession<State> = {
      ...composed,
      id: definition.id,
      catalog: source.catalog,
      projectPlanningState: source.projectPlanningState,
      modifyAttributes: source.modifyAttributes,
      modifyConditionAttributes: source.modifyConditionAttributes,
      modifyCriticalChance: source.modifyCriticalChance,
      modifyCriticalDamage: source.modifyCriticalDamage,
      modifyStrikeDamage: source.modifyStrikeDamage,
      modifyConditionDamage: source.modifyConditionDamage,
      modifyConditionDuration: source.modifyConditionDuration,
      modifyConditionBaseDuration: source.modifyConditionBaseDuration,
      // Preview and simulation share the same validated Core/elite state composition.
      createState: source.createState,
      autoattackChainOverrides: definition.autoattackChains?.overrides,
      weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
      availability(context, skill, command) {
        if (!isBuildSkillAvailable(skill, context.config))
          return denyCast('gw2.build-unavailable', `${skill.name} is unavailable for this build.`);
        if (definition.requireEquippedSlotSkills) {
          const slot = selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill);
          if (slot) return slot;
        }

        const cost = skillCostAvailability(context, skill);
        if (cost && !cost.ready && cost.retryAt == null) return cost;
        const result = composed.availability!(context, skill, command);
        if (!result.ready && result.retryAt == null) return result;
        if (cost && !cost.ready)
          return {
            ...(!result.ready ? result : cost),
            retryAt: Math.max(context.time, cost.retryAt, !result.ready ? result.retryAt : context.time)
          };
        return result;
      }
    };

    // Bind actions on base and profile effects after Core and elite handlers have been composed.
    for (const owner of [...runtime.catalog.skills, ...runtime.catalog.balanceProfiles]) {
      const actions = [
        ...((owner as Skill).sideEffects ?? []).map((rule) => rule.do),
        ...(owner.effects ?? []).flatMap((effect) => (effect.reactions ?? []).flatMap((rule) => rule.do))
      ];
      for (const action of actions)
        if (action.type.includes('.') && typeof runtime.sideEffectHandlers?.[action.type] !== 'function')
          throw new TypeError(`Skill ${owner.id} has no side-effect handler registered for ${action.type}.`);
    }

    selection.runtime = runtime;
    return runtime;
  }

  // The native owner exposes application services directly, without translating another module or family shell.
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: assembly.catalog,
    nativeDefinition: Object.freeze({ ...definition }),
    traitBuildAttributes: ((common, context, activeTraits) => {
      const balanceContext = context.balanceContext ?? {
        catalog: assembly.catalog,
        modifierRulesById: new Map(
          modules
            .flatMap((module) =>
              Array.isArray(module.modifiers)
                ? module.modifiers
                : ((module.modifiers as ProfessionModifierDefinition | undefined)?.modifierRules ?? [])
            )
            .map((rule) => [rule.id, rule])
        )
      };
      const active = new Set(
        activeTraits.filter((trait) => trait.name !== context.disabledTrait).map((trait) => trait.id)
      );
      return modules.flatMap((module) =>
        (module.traitDefinitions ?? []).flatMap((trait) =>
          trait.buildAttributes && hasTrait(active, trait.id)
            ? [trait.buildAttributes(common, { ...context, balanceContext })]
            : []
        )
      );
    }) satisfies Gw2TraitBuildAttributeCalculator,
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
          family: familyUi,
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
