import { validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { composeGw2Reactions } from '#gw2/platform/resolver/reaction-registry.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Only this explicit contribution surface is accepted; catalog/formula ownership stays in native compilation. */
export type RuntimeHooks<State extends object, TSkill extends Skill = Skill> = Partial<
  Pick<
    RuntimeProfession<State, TSkill>,
    | 'damageEffects'
    | 'prepareDamageState'
    | 'buffPolicies'
    | 'observeEffects'
    | 'resources'
    | 'endurance'
    | 'playerAlacrityRechargeRate'
    | 'initialize'
    | 'availability'
    | 'castDurationMs'
    | 'castDetail'
    | 'modifySkillId'
    | 'resolveCastSkill'
    | 'resolveInputControl'
    | 'modifyComboFields'
    | 'modifyEffects'
    | 'boonDuration'
    | 'effectOwner'
    | 'prepareEvent'
    | 'onCastStart'
    | 'onCastCommit'
    | 'onCastCancel'
    | 'onAutoattackChainTransition'
    | 'onCooldownReset'
    | 'onCombatStart'
    | 'tasks'
    | 'backgroundTasks'
    | 'sideEffectHandlers'
    | 'eventHandlers'
    | 'reactions'
    | 'rechargeWork'
    | 'rechargeStart'
    | 'maximumAmmo'
    | 'reserveRecharge'
    | 'rechargeCompanionId'
    | 'traitTriggers'
    | 'rechargeRules'
  >
>;

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

/** Value transforms feed each result to the next contributor; a nullish result keeps the incoming value. */
const transformSecond: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, value) => only(a, value) ?? value
    : (a, value) => {
        for (const fn of fns) value = fn(a, value) ?? value;
        return value;
      };
};

/** Same transform rule for slots whose value is the third argument. */
const transformThird: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b, value) => only(a, b, value) ?? value
    : (a, b, value) => {
        for (const fn of fns) value = fn(a, b, value) ?? value;
        return value;
      };
};

/** Same transform rule for slots whose value is the fourth argument. */
const transformFourth: CombineRule = (fns) => {
  const [only] = fns;
  return fns.length === 1
    ? (a, b, c, value) => only(a, b, c, value) ?? value
    : (a, b, c, value) => {
        for (const fn of fns) value = fn(a, b, c, value) ?? value;
        return value;
      };
};

/** Policy lists concatenate in declaration order into a fresh array. */
const collect: CombineRule = (fns) => (a) => fns.flatMap((fn) => (fn(a) as readonly unknown[] | undefined) ?? []);

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

type Availability = ReturnType<NonNullable<RuntimeHooks<object>['availability']>>;

/** Permanent denials win immediately; retryable denials keep the latest retry boundary across contributors. */
const availability: CombineRule = (fns) => (context, skill, command) => {
  let retryAt = (context as { readonly time: number }).time;
  let blocked: Availability = { ready: true };

  for (const fn of fns) {
    const result = fn(context, skill, command) as Availability | undefined;

    if (result && !result.ready) {
      if (result.retryAt == null) return result;

      retryAt = Math.max(retryAt, result.retryAt);
      blocked = { ...result, retryAt };
    }
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
  rechargeStart: transformThird,
  // Read-only capacity policies transform in declaration order; zero intentionally disables the pool.
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
  ): RuntimeProfession<State, TSkill>[K] => {
    const entries = hooks.flatMap((hook) => Object.entries(hook[key] ?? {}));

    if (new Set(entries.map(([name]) => name)).size !== entries.length)
      throw new TypeError(`Duplicate hook ${key} owner.`);

    return Object.fromEntries(entries) as RuntimeProfession<State, TSkill>[K];
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
