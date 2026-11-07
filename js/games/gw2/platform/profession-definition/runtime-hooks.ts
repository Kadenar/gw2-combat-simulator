/** Declare author-owned execution policies and compose each accepted contribution in its domain order. */
import type { CastCommand } from '#gw2/platform/builds/rotation.js';
import type { EndurancePolicy, ResourceKey, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ActionContext, CustomSideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { AutoattackChainTransitionResult } from '#gw2/platform/execution/autoattack-chains.js';
import { CAST_READY, combineAvailability, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type {
  CastDetailContext,
  EffectOwnershipContext,
  MaximumAmmoContext,
  SelectedContentContext,
  TraitSelectionContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import type { RechargeRule, TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import { composeGw2Reactions } from '#gw2/platform/resolver/reaction-registry.js';
import type { Gw2ResolverReactions } from '#gw2/platform/resolver/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Explicit author contributions keep executable policies separate from compiler-owned catalogs and calculations. */
export interface RuntimeHooks<T extends object, TSkill extends Skill = Skill> {
  /** Explicit payloads are measurable without running their activation predicates. */
  readonly damageEffects?: readonly import('#gw2/platform/skill-damage/types.js').DamageEffectDefinition[];
  /** Content owners prepare shared damage inputs; an optional skill adds its occurrence-specific state. */
  prepareDamageState?(
    runtime: MechanicContext<T, TSkill>,
    skill: TSkill | undefined,
    inputs: import('#gw2/platform/skill-damage/types.js').DamageInputs
  ): void;
  /** Native owners expose accepted state using their existing stores and balance values. */
  buffPolicies?(
    runtime: MechanicQueryContext<T, TSkill>
  ): readonly import('#gw2/platform/combat/effect-state.js').BuffStatePolicy[];
  observeEffects?(
    runtime: MechanicQueryContext<T, TSkill>
  ): readonly import('#gw2/platform/combat/effect-state.js').EffectState[];
  readonly rechargeRules?: readonly RechargeRule<T, TSkill>[];
  readonly traitTriggers?: readonly TraitTrigger<T, TSkill>[];
  initialize?(runtime: MechanicContext<T, TSkill>): void;
  /** Select cancellation ownership without publishing or transforming the packet. */
  effectOwner?(context: EffectOwnershipContext<TSkill>, event: SimulationEventBase): WorkOwner | undefined;
  /** Prepare at admission or an owned future impact; null suppresses the application. */
  prepareEvent?(runtime: MechanicContext<T, TSkill>, event: SimulationEventBase): SimulationEventBase | null;
  /** Profession duration rules run once at application, independently of payload authoring and source identity. */
  boonDuration?(
    context: SelectedContentContext,
    event: SimulationEventBase,
    baseDuration: number,
    scaledDuration: number
  ): number;
  onCombatStart?(runtime: MechanicContext<T, TSkill>): void;
  readonly resources?: Partial<Record<ResourceKey, ResourcePolicy<MechanicContext<T, TSkill>>>>;
  readonly endurance?: EndurancePolicy<MechanicContext<T, TSkill>>;
  reserveRecharge?(runtime: MechanicContext<T, TSkill>, skill: TSkill, work: number): number;
  /** Selects the companion incarnation once at acceptance for received-boon recharge. */
  rechargeCompanionId?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill): string | undefined;
  /** Resolve controls before state changes; null excludes movement-only commands, undefined uses the standard bar. */
  resolveInputControl?(
    context: MechanicQueryContext<T, TSkill>,
    skill: TSkill,
    command: CastCommand
  ): import('#gw2/platform/execution/input-controls.js').InputControl | null | undefined;
  /** Resolve contextual inputs such as swapping out of a kit before checking cast eligibility. */
  resolveCastSkill?(context: MechanicQueryContext<T, TSkill>, skill: TSkill): TSkill;
  /** Resolve the trait-selected action before catalog, equipment, chain, and recharge checks. */
  modifySkillId?(context: TraitSelectionContext, skillId: SkillId): SkillId;
  rechargeWork?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, work: number): number;
  /** Select the activation duration from current state before reserving its completion and packet timing. */
  castDurationMs?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, durationMs: number): number;
  /** Capture the selected cast variant once so reports do not query later profession state. */
  castDetail?(context: CastDetailContext<T>, cast: RuntimeCast<TSkill>): string | undefined;
  /** Capacity selection cannot mutate the pools whose initialization it controls. */
  maximumAmmo?(context: MaximumAmmoContext<T>, skill: TSkill, maximum: number): number;
  availability?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, command: CastCommand): AvailabilityResult;
  /** Capture dynamic field descriptors at acceptance, before cast-start resource mutations. */
  modifyComboFields?(
    runtime: MechanicQueryContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    fields: Skill['comboFields']
  ): Skill['comboFields'];
  modifyEffects?(
    runtime: MechanicContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    effects: readonly SkillEffect[]
  ): readonly SkillEffect[];
  onCastStart?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Successful casts settle once after declared commit effects, including committed interruptions. */
  onCastCommit?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Cancelled attempts release reservations and cast-local state without granting commit rewards. */
  onCastCancel?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  readonly sideEffectHandlers?: Readonly<
    Record<
      string,
      (runtime: MechanicContext<T, TSkill>, context: ActionContext<TSkill>, action: CustomSideEffectAction) => void
    >
  >;
  onAutoattackChainTransition?(
    runtime: MechanicContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    result: AutoattackChainTransitionResult
  ): void;
  onCooldownReset?(runtime: MechanicContext<T, TSkill>): void;
  /** Persistent ambient loops run normally but do not define an isolated cast's observation lifetime. */
  readonly backgroundTasks?: readonly string[];
  readonly tasks?: Readonly<Record<string, (runtime: MechanicContext<T, TSkill>, data: unknown) => void>>;
  readonly eventHandlers?: Readonly<
    Record<string, (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent) => void>
  >;
  readonly reactions?: Gw2ResolverReactions<MechanicContext<T, TSkill>>;
  /** Selected modules own the player Alacrity strength used by cooldown queries. */
  readonly playerAlacrityRechargeRate?: number;
}

type HookKey = keyof RuntimeHooks<object>;

/** Every function-valued contribution slot; the rule table must name a combination rule for each one. */
type CallbackKey = {
  [K in HookKey]-?: NonNullable<RuntimeHooks<object>[K]> extends (...args: never[]) => unknown ? K : never;
}[HookKey];

/** Contributions combine untyped; each rule preserves its slot's declared signature and argument order. */
type Callback = (a?: unknown, b?: unknown, c?: unknown, d?: unknown) => unknown;
type CombineRule = (contributors: readonly Callback[]) => Callback;

/** Notifications run every contributor in declaration order and return nothing. */
const notify: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b, c) => {
        only(a, b, c);
      }
    : (a, b, c) => {
        for (const fn of fns) fn(a, b, c);
      };
};

/** Value transforms feed each result to the next contributor; unchanged contributions return their input. */
const transformSecond: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, value) => only(a, value)
    : (a, value) => {
        for (const fn of fns) value = fn(a, value);
        return value;
      };
};

/** Same transform rule for slots whose value is the third argument. */
const transformThird: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b, value) => only(a, b, value)
    : (a, b, value) => {
        for (const fn of fns) value = fn(a, b, value);
        return value;
      };
};

/** Same transform rule for slots whose value is the fourth argument. */
const transformFourth: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b, c, value) => only(a, b, c, value)
    : (a, b, c, value) => {
        for (const fn of fns) value = fn(a, b, c, value);
        return value;
      };
};

/** Policy lists concatenate in declaration order; contributors with no entries return an empty array. */
const collect: CombineRule = (fns) => (a) => fns.flatMap((fn) => fn(a) as readonly unknown[]);

/** Later defined labels override earlier ones; a nullish label keeps the prior one. */
const lastDefined: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b) => only(a, b) ?? undefined
    : (a, b) => {
        let detail: unknown;
        for (const fn of fns) detail = fn(a, b) ?? detail;
        return detail;
      };
};

/** The most specific contributor answers first, so modules can resolve controls that replace Core bars. */
const mostSpecificResolution: CombineRule = (fns) => {
  const reversed = [...fns].reverse();
  return (a, b, c) => {
    for (const fn of reversed) {
      const resolved = fn(a, b, c);

      if (resolved !== undefined) return resolved;
    }

    return undefined;
  };
};

/** The first non-null answer wins, such as the module owning a skill's accepted companion incarnation. */
const firstDefined: CombineRule = (fns) => (a, b) => {
  for (const fn of fns) {
    const candidate = fn(a, b);

    if (candidate != null) return candidate;
  }

  return undefined;
};

/** Ownership is selected once at admission; conflicting lifetimes are an authoring error. */
const agreedOwner: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b) => only(a, b) ?? undefined
    : (a, b) => {
        let owner: WorkOwner | undefined;
        for (const fn of fns) {
          const candidate = fn(a, b) as WorkOwner | null | undefined;

          if (candidate && owner && (candidate.id !== owner.id || candidate.generation !== owner.generation))
            throw new TypeError('Conflicting effect lifetime owners.');

          owner = candidate ?? owner;
        }

        return owner;
      };
};

/** Event preparation chains each result into the next stage; null suppresses the event for later stages. */
const pipeline: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, event) => only(a, event)
    : (a, event) => {
        for (const fn of fns) {
          const prepared = fn(a, event);

          if (prepared === null) return null;

          event = prepared;
        }

        return event;
      };
};

/** Permanent denials win immediately; retryable denials keep the latest retry boundary across contributors. */
const availability: CombineRule = (fns) => (context, skill, command) => {
  const time = (context as { readonly time: number }).time;
  let blocked: AvailabilityResult = CAST_READY;

  for (const fn of fns) {
    const result = fn(context, skill, command) as AvailabilityResult;
    blocked = combineAvailability(blocked, result, time);

    if (!blocked.ready && blocked.retryAt === null) return blocked;
  }

  return blocked;
};

/** One combination rule per callback; adding a callback to RuntimeHooks without a rule fails to type-check. */
const CALLBACK_RULES = {
  prepareDamageState: notify,
  initialize: notify,
  onCastStart: notify,
  onCastCommit: notify,
  onCastCancel: notify,
  onAutoattackChainTransition: notify,
  onCooldownReset: notify,
  onCombatStart: notify,
  buffPolicies: collect,
  observeEffects: collect,
  resolveCastSkill: transformSecond,
  modifySkillId: transformSecond,
  castDurationMs: transformThird,
  modifyComboFields: transformThird,
  modifyEffects: transformThird,
  // Core and specialization modifiers compose before the runtime reserves the selected work.
  rechargeWork: transformThird,
  // Read-only capacity policies transform in declaration order; zero disables the pool.
  maximumAmmo: transformThird,
  reserveRecharge: transformThird,
  // Compose game rules after shared duration scaling; authors never need a profession-specific emitter.
  boonDuration: transformFourth,
  castDetail: lastDefined,
  resolveInputControl: mostSpecificResolution,
  rechargeCompanionId: firstDefined,
  effectOwner: agreedOwner,
  prepareEvent: pipeline,
  availability
} satisfies Record<CallbackKey, CombineRule>;

/** Compose notifications, transforms, decisions, and task ownership using the same rules within and across modules. */
export function composeRuntimeHooks<State extends object, TSkill extends Skill = Skill>(
  hooks: readonly RuntimeHooks<State, TSkill>[]
): RuntimeHooks<State, TSkill> {
  const merged = <K extends 'tasks' | 'eventHandlers' | 'sideEffectHandlers'>(
    key: K
  ): RuntimeHooks<State, TSkill>[K] => {
    const entries = hooks.flatMap((hook) => Object.entries(hook[key] ?? {}));

    if (new Set(entries.map(([name]) => name)).size !== entries.length)
      throw new TypeError(`Duplicate hook ${key} owner.`);

    return Object.fromEntries(entries) as RuntimeHooks<State, TSkill>[K];
  };

  const structure = {
    traitTriggers: hooks.flatMap((hook) => hook.traitTriggers ?? []),
    rechargeRules: hooks.flatMap((hook) => hook.rechargeRules ?? []),
    damageEffects: hooks.flatMap((hook) => hook.damageEffects ?? []),
    resources: Object.assign({}, ...hooks.map((hook) => hook.resources)),
    endurance: [...hooks].reverse().find((hook) => hook.endurance)?.endurance,
    playerAlacrityRechargeRate: [...hooks].reverse().find((hook) => hook.playerAlacrityRechargeRate != null)
      ?.playerAlacrityRechargeRate,
    tasks: merged('tasks'),
    backgroundTasks: hooks.flatMap((hook) => hook.backgroundTasks ?? []),
    sideEffectHandlers: merged('sideEffectHandlers'),
    eventHandlers: merged('eventHandlers'),
    reactions: composeGw2Reactions(hooks.map((hook) => hook.reactions ?? {}))
  } satisfies RuntimeHooks<State, TSkill> & Record<Exclude<HookKey, CallbackKey>, unknown>;
  // A new accepted field must be implemented above; unknown JavaScript declarations fail instead of disappearing.
  for (const hook of hooks)
    for (const key of Object.keys(hook))
      if (!Object.hasOwn(structure, key) && !Object.hasOwn(CALLBACK_RULES, key))
        throw new TypeError(`Unsupported runtime hook ${key}.`);
  // Capacity previews consume these policies before simulation, so validate the selected declarations here too.
  validateResourcePolicies(structure.resources, structure.endurance);
  // Uncontributed callbacks are omitted so an enclosing composition and the runtime skip them entirely.
  const callbacks = Object.entries(CALLBACK_RULES).flatMap(([key, rule]) => {
    const contributors = hooks.flatMap((hook) => {
      const callback = hook[key as CallbackKey];
      return callback ? [callback as Callback] : [];
    });
    return contributors.length ? [[key, rule(contributors)] as const] : [];
  });
  return { ...structure, ...Object.fromEntries(callbacks) };
}
