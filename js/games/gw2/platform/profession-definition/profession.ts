import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import { defineProfessionFamily } from '#gw2/platform/engine/profession/family.js';
import { composeStateFragments } from '#gw2/platform/engine/profession/module.js';
import type { RuntimeProfession, Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/skill-eligibility.js';
import { denyCast } from '#gw2/platform/engine/skills/availability.js';
import type {
  ProfessionFamilyDefinition,
  ProfessionAttributeRuleDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition
} from '#gw2/platform/engine/profession/types.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { ProfessionConfig } from '#gw2/platform/execution/types.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState
} from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { validateAutoattackChainOptions } from '#gw2/platform/skills/autoattack-chain-controller.js';

/** Policies a family exposes for capacity previews; their maximum reads only configuration and catalog. */
type ProfessionResourcePreview = ReturnType<NonNullable<ProfessionFamilyDefinition['resourcesFor']>>;

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
  'resources',
  'modifiers',
  'hooks',
  'presentation'
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
  if (!String(candidate.id || '').trim()) {
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
  TModifierEscape extends ProfessionAttributeRuleDefinition = object,
  TPresentation extends object = object
>(
  definition: NativeModuleDefinition<TId, TState, TProjectOptions, TProjectedState, TModifierEscape, TPresentation>
): NativeModule<TId, TState, TProjectOptions, TProjectedState, TModifierEscape, TPresentation> {
  assertNativeModuleDefinition(definition);
  return Object.freeze({
    ...definition,
    kind: 'native-profession-module' as const,
    data: Object.freeze({ ...definition.data }),
    state: Object.freeze({ ...definition.state }),
    hooks: definition.hooks ? Object.freeze({ ...definition.hooks }) : undefined,
    presentation:
      typeof definition.presentation === 'function'
        ? definition.presentation
        : definition.presentation
          ? Object.freeze({ ...definition.presentation })
          : undefined
  });
}

function compileNativeModule(
  module: AnyNativeModule,
  applicationCatalog: Readonly<CanonicalCatalog>,
  fragment: Readonly<ProfessionModuleCatalogFragment>
): ProfessionModuleDefinition {
  const modifiers = Array.isArray(module.modifiers) ? { modifierRules: module.modifiers } : module.modifiers;
  let compiledUi: Partial<ProfessionUiContract> | undefined;
  return {
    id: module.id,
    catalog: fragment,
    resources: {
      ...module.resources,
      createState: module.state.create as (config: Readonly<ProfessionConfig>) => UnvalidatedFields,
      ...(module.state.project == null ? {} : { projectPlanningState: module.state.project })
    },
    attributeRules: modifiers as ProfessionAttributeRuleDefinition | undefined,
    get ui() {
      if (compiledUi) return compiledUi;
      const presentation =
        typeof module.presentation === 'function' ? module.presentation(applicationCatalog) : module.presentation;
      const ui = { ...(presentation as Partial<ProfessionUiContract> | undefined) };
      if (module.id === 'Core') {
        const paletteAvailability = ui.paletteSkillAvailability;
        // Resolve preview selection once so the availability gate and profession callback use the same specialization.
        ui.paletteSkillAvailability = (context, skill) => {
          const config = context.config as { readonly specialization?: string } | undefined;
          const build = context.build as { readonly specialization?: string } | undefined;
          const specialization = String(
            context.specialization || config?.specialization || build?.specialization || skill.specialization || 'Core'
          );
          return isBuildSkillAvailable(skill, { specialization })
            ? (paletteAvailability?.({ ...context, specialization }, skill) ?? { available: true, message: '' })
            : { available: false, message: `${skill.name} is unavailable for this build.` };
        };
      }

      return (compiledUi = ui);
    }
  };
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

  validateAutoattackChainOptions(definition.autoattackChains ?? {});
  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const core = modules[0];
  const engineDefinition: ProfessionFamilyDefinition<TBuild> = {
    id: definition.id,
    name: definition.name,
    weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
    catalog: assembly.catalog,
    build: definition.build,
    core: compileNativeModule(core, assembly.catalog, assembly.fragments.get('Core')!),
    specializations: Object.fromEntries(
      modules
        .slice(1)
        .map((module) => [module.id, compileNativeModule(module, assembly.catalog, assembly.fragments.get(module.id)!)])
    ),
    // Bind family controls directly, without relying on a Core UI initialization side effect.
    ui: (typeof definition.presentation === 'function'
      ? definition.presentation(assembly.catalog)
      : definition.presentation) as Partial<ProfessionUiContract> | undefined,
    // Capacity previews read the resource policies owned by the selected modules' hooks.
    resourcesFor(specialization) {
      const runtime = runtimeFor({ specialization });
      return {
        ...(runtime.resources as ProfessionResourcePreview),
        ...(runtime.endurance == null
          ? {}
          : { endurance: runtime.endurance as unknown as ProfessionResourcePreview['endurance'] })
      };
    }
  };
  const family = defineProfessionFamily<NativeProfessionRuntimeState<TModules>, TBuild>(engineDefinition);
  type State = NativeProfessionRuntimeState<TModules>;
  const runtimes = new Map<string, RuntimeProfession<State>>();
  /** Composes Core and the selected specialization's hooks over the resolved profession's catalog and modifiers. */
  function runtimeFor(config: Gw2Config): RuntimeProfession<State> {
    const specialization = config.specialization ?? 'Core';
    const cached = runtimes.get(specialization);
    if (cached) return cached;
    const selected = [core, ...modules.slice(1).filter((module) => module.id === specialization)];
    if (specialization !== 'Core' && selected.length !== 2)
      throw new TypeError(`Unknown specialization: ${specialization}.`);
    const source = family.resolveProfession(config);
    const hooks = selected.map((module) => module.hooks ?? {}) as Partial<RuntimeProfession<State>>[];
    const merged = <K extends 'tasks' | 'eventHandlers'>(key: K): RuntimeProfession<State>[K] => {
      const entries = hooks.flatMap((hook) => Object.entries(hook[key] ?? {}));
      if (new Set(entries.map(([name]) => name)).size !== entries.length)
        throw new TypeError(`Duplicate hook ${key} owner.`);
      return Object.fromEntries(entries) as RuntimeProfession<State>[K];
    };

    const stages = new Set(hooks.flatMap((hook) => Object.keys(hook.reactions ?? {}))) as Set<Gw2ResolverStage>;
    const runtime: RuntimeProfession<State> = {
      id: definition.id,
      catalog: source.catalog,
      projectPlanningState: source.projectPlanningState,
      modifyAttributes: source.modifyAttributes,
      modifyCriticalChance: source.modifyCriticalChance,
      modifyCriticalDamage: source.modifyCriticalDamage,
      modifyStrikeDamage: source.modifyStrikeDamage,
      modifyConditionDamage: source.modifyConditionDamage,
      modifyConditionDuration: source.modifyConditionDuration,
      modifyConditionBaseDuration: source.modifyConditionBaseDuration,
      createState: (initial) =>
        composeStateFragments(
          selected.map((module) => ({
            name: module.id,
            module: module.id === 'Core' ? engineDefinition.core : engineDefinition.specializations[module.id]
          })),
          initial
        ) as State,
      resources: Object.assign({}, ...hooks.map((hook) => hook.resources)),
      endurance: [...hooks].reverse().find((hook) => hook.endurance)?.endurance,
      autoattackChainOverrides: definition.autoattackChains?.overrides,
      weaponSkillMatchesSet: definition.weaponSkillMatchesSet,
      initialize(context) {
        for (const hook of hooks) hook.initialize?.(context);
      },
      availability(context, skill, command) {
        // Build eligibility precedes profession mechanics, including transformed skill bars.
        if (!isBuildSkillAvailable(skill, context.config))
          return denyCast('gw2.build-unavailable', `${skill.name} is unavailable for this build.`);
        let retryAt = context.time;
        let blocked: ReturnType<NonNullable<RuntimeProfession<State>['availability']>> = { ready: true };
        for (const hook of hooks) {
          const result = hook.availability?.(context, skill, command);
          if (result && !result.ready) {
            if (result.retryAt == null) return result;
            retryAt = Math.max(retryAt, result.retryAt);
            blocked = { ...result, retryAt };
          }
        }

        return blocked;
      },
      castDurationMs(context, skill, durationMs) {
        for (const hook of hooks) durationMs = hook.castDurationMs?.(context, skill, durationMs) ?? durationMs;
        return durationMs;
      },
      castDetail(context, cast) {
        let detail: string | undefined;
        for (const hook of hooks) detail = hook.castDetail?.(context, cast) ?? detail;
        return detail;
      },
      modifySkillId(context, skillId) {
        for (const hook of hooks) skillId = hook.modifySkillId?.(context, skillId) ?? skillId;
        return skillId;
      },
      modifyComboFields(context, cast, fields) {
        for (const hook of hooks) fields = hook.modifyComboFields?.(context, cast, fields) ?? fields;
        return fields;
      },
      modifyEffects(context, cast, effects) {
        for (const hook of hooks) effects = hook.modifyEffects?.(context, cast, effects) ?? effects;
        return effects;
      },
      prepareEvent(context, event) {
        for (const hook of hooks) {
          const prepared = hook.prepareEvent ? hook.prepareEvent(context, event) : event;
          if (prepared === null) return null;
          event = prepared;
        }

        return event;
      },
      onCastStart(context: Gw2Runtime<State>, cast: RuntimeCast) {
        for (const hook of hooks) hook.onCastStart?.(context, cast);
      },
      onCastComplete(context, cast) {
        for (const hook of hooks) hook.onCastComplete?.(context, cast);
      },
      onAutoattackChainTransition(context, cast, result) {
        for (const hook of hooks) hook.onAutoattackChainTransition?.(context, cast, result);
      },
      onCooldownReset(context) {
        for (const hook of hooks) hook.onCooldownReset?.(context);
      },
      onCombatStart(context) {
        for (const hook of hooks) hook.onCombatStart?.(context);
      },
      tasks: merged('tasks'),
      eventHandlers: merged('eventHandlers'),
      reactions: Object.fromEntries(
        [...stages].map((stage) => [
          stage,
          (context: Gw2Runtime<State>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
            let updates: Record<string, unknown> | undefined;
            for (const hook of hooks) {
              const result = hook.reactions?.[stage]?.(context, updates ? { ...event, ...updates } : event, details);
              if (result) updates = { ...updates, ...result };
            }

            return updates;
          }
        ])
      ),
      rechargeWork(context, skill, work) {
        // Core and specialization modifiers compose before the runtime reserves the selected work.
        for (const hook of hooks) work = hook.rechargeWork?.(context, skill, work) ?? work;
        return work;
      },
      rechargeStart(context, cast, at) {
        for (const hook of hooks) at = hook.rechargeStart?.(context, cast, at) ?? at;
        return at;
      },
      maximumAmmo(context, skill, maximum) {
        // Selected modules adjust the same pool cap used by cast acceptance and serial recharge.
        for (const hook of hooks) maximum = hook.maximumAmmo?.(context, skill, maximum) ?? maximum;
        return maximum;
      },
      reserveRecharge(context, skill, work) {
        for (const hook of hooks) work = hook.reserveRecharge?.(context, skill, work) ?? work;
        return work;
      }
    };
    runtimes.set(specialization, runtime);
    return runtime;
  }

  // Retain lazy application getters while exposing the immutable native compilation input.
  return Object.freeze(
    Object.defineProperties(
      {
        nativeDefinition: Object.freeze({ ...definition }),
        runtimeFor,
        specializationIds: Object.freeze(modules.slice(1).map((module) => module.id))
      },
      Object.getOwnPropertyDescriptors(family)
    )
  ) as NativeProfessionContract<TModules, TPresentation, TBuild>;
}
