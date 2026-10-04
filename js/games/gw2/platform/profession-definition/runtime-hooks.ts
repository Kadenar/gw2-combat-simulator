import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/internal-work.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

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
    | 'traitTriggers'
    | 'rechargeRules'
  >
>;

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

  const stages = new Set(hooks.flatMap((hook) => Object.keys(hook.reactions ?? {}))) as Set<Gw2ResolverStage>;
  const composed = {
    traitTriggers: hooks.flatMap((hook) => hook.traitTriggers ?? []),
    rechargeRules: hooks.flatMap((hook) => hook.rechargeRules ?? []),
    damageEffects: hooks.flatMap((hook) => hook.damageEffects ?? []),
    prepareDamageState(context, skill, inputs) {
      for (const hook of hooks) hook.prepareDamageState?.(context, skill, inputs);
    },
    buffPolicies(context) {
      return hooks.flatMap((hook) => hook.buffPolicies?.(context) ?? []);
    },
    observeEffects(context) {
      return hooks.flatMap((hook) => hook.observeEffects?.(context) ?? []);
    },
    resources: Object.assign({}, ...hooks.map((hook) => hook.resources)),
    endurance: [...hooks].reverse().find((hook) => hook.endurance)?.endurance,
    playerAlacrityRechargeRate: [...hooks].reverse().find((hook) => hook.playerAlacrityRechargeRate != null)
      ?.playerAlacrityRechargeRate,
    initialize(context) {
      for (const hook of hooks) hook.initialize?.(context);
    },
    availability(context, skill, command) {
      let retryAt = context.time;
      let blocked: ReturnType<NonNullable<RuntimeProfession<State, TSkill>['availability']>> = { ready: true };

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
      // Later defined labels override earlier ones; all contributors read the same acceptance-state capability.
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
    // Compose game rules after shared duration scaling; authors never need a profession-specific emitter.
    boonDuration(context, event, baseDuration, scaledDuration) {
      for (const hook of hooks)
        scaledDuration = hook.boonDuration?.(context, event, baseDuration, scaledDuration) ?? scaledDuration;
      return scaledDuration;
    },
    // Ownership is selected once at admission; conflicting lifetimes are an authoring error.
    effectOwner(context, event) {
      let owner: WorkOwner | undefined;
      for (const hook of hooks) {
        const candidate = hook.effectOwner?.(context, event);
        if (candidate && owner && (candidate.id !== owner.id || candidate.generation !== owner.generation))
          throw new TypeError('Conflicting effect lifetime owners.');
        owner = candidate ?? owner;
      }

      return owner;
    },
    prepareEvent(context, event) {
      for (const hook of hooks) {
        const prepared = hook.prepareEvent ? hook.prepareEvent(context, event) : event;
        if (prepared === null) return null;
        event = prepared;
      }

      return event;
    },
    onCastStart(context: MechanicContext<State, TSkill>, cast: RuntimeCast<TSkill>) {
      for (const hook of hooks) hook.onCastStart?.(context, cast);
    },
    onCastCommit(context, cast) {
      for (const hook of hooks) hook.onCastCommit?.(context, cast);
    },
    onCastCancel(context, cast) {
      for (const hook of hooks) hook.onCastCancel?.(context, cast);
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
    backgroundTasks: hooks.flatMap((hook) => hook.backgroundTasks ?? []),
    sideEffectHandlers: merged('sideEffectHandlers'),
    eventHandlers: merged('eventHandlers'),
    reactions: Object.fromEntries(
      [...stages].map((stage) => [
        stage,
        (context: MechanicContext<State, TSkill>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
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
      // Read-only capacity policies transform in declaration order; zero intentionally disables the pool.
      for (const hook of hooks) maximum = hook.maximumAmmo?.(context, skill, maximum) ?? maximum;
      return maximum;
    },
    reserveRecharge(context, skill, work) {
      for (const hook of hooks) work = hook.reserveRecharge?.(context, skill, work) ?? work;
      return work;
    }
  } satisfies RuntimeHooks<State, TSkill> & Record<keyof RuntimeHooks<State, TSkill>, unknown>;
  // A new accepted field must be implemented above; unknown JavaScript declarations fail instead of disappearing.
  for (const hook of hooks)
    for (const key of Object.keys(hook))
      if (!Object.hasOwn(composed, key)) throw new TypeError(`Unsupported runtime hook ${key}.`);
  return composed;
}
