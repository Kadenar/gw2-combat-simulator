import type { ResolvedEffectTrigger } from '#gw2/platform/simulation/effect-reactions.js';
import type { EffectEventBase } from '#gw2/platform/engine/effects/materializer.js';
import type { Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';

export type ProfileAmount = number | { readonly profile: SkillId; readonly field: string };
// Resource grants may read the accepted skill's live tuning without duplicating it in a balance profile.
type ResourceGrantAmount = ProfileAmount | { readonly skillField: string };

export type SideEffectAction =
  | { readonly type: 'rechargeReset'; readonly skillIds: readonly SkillId[] }
  | { readonly type: 'ammoRestore'; readonly skillIds: readonly SkillId[]; readonly count: ProfileAmount }
  | {
      readonly type: 'resourceGrant';
      readonly resource: ResourceKey | 'endurance';
      readonly amount: ResourceGrantAmount;
    }
  | {
      readonly type: 'flipArm';
      readonly skillId: SkillId;
      /** Null keeps the flip exposed until its owner consumes it; omission uses the skill's flipDuration. */
      readonly durationSec?: ProfileAmount | null;
      readonly expiryPriority?: number;
    }
  | { readonly type: 'flipConsume'; readonly skillId: SkillId }
  | {
      readonly type: 'emitProfile';
      readonly profileId: SkillId;
      /** Select the trigger's own effects from a shared profile without duplicating its balance data. */
      readonly effects?: (effect: SkillEffect) => boolean;
      /** Preserve the existing proc label when a skill moves onto profile emission. */
      readonly attribution?: Partial<EffectEventBase> & { readonly name?: string };
    }
  | { readonly type: `${string}.${string}`; readonly amount?: ProfileAmount };

/** Actions receive their actual trigger; impact work never fabricates a cast reservation. */
export type ActionContext<TSkill extends Skill = Skill> =
  | { readonly kind: 'cast'; readonly skill: TSkill; readonly cast: RuntimeCast<TSkill> }
  | { readonly kind: 'effect'; readonly skill: TSkill; readonly trigger: ResolvedEffectTrigger };

export interface SkillSideEffect {
  readonly on: 'castStart' | 'castCommit';
  readonly order?: number;
  readonly when?: (runtime: Gw2Runtime, cast: RuntimeCast) => boolean;
  readonly do: SideEffectAction;
}

/** Resolve live patch data at the point of application, rejecting invalid amounts before mutating a pool. */
export function sideEffectAmount(runtime: Gw2Runtime, amount: ResourceGrantAmount, skill?: Skill): number {
  const value =
    typeof amount === 'number'
      ? amount
      : 'skillField' in amount
        ? skill?.[amount.skillField]
        : balanceProfileNumber(requireBalanceProfileFromContext(runtime, amount.profile), amount.field);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new RangeError('Side-effect amounts must be finite and non-negative.');
  return value;
}

/** The platform owns ordinary pool and packet mutations; named profession verbs retain state-machine ownership. */
export function applySideEffect(
  runtime: Gw2Runtime,
  context: ActionContext,
  action: SideEffectAction,
  handlers: Readonly<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handlers belong to the selected profession, while shared dispatch erases its private state type.
    Record<string, (runtime: Gw2Runtime<any>, context: ActionContext, action: SideEffectAction) => void>
  > = {}
): void {
  switch (action.type) {
    case 'rechargeReset':
      for (const id of action.skillIds) runtime.cooldownController.clear(id);
      return;
    case 'ammoRestore': {
      const count = sideEffectAmount(runtime, action.count);
      for (const id of action.skillIds) {
        const skill = runtime.helpers.skillsById.get(id);
        if (!skill) throw new TypeError(`Unknown ammo restoration skill: ${id}.`);
        runtime.cooldownController.restoreAmmo(skill, count, runtime.time, 'reset');
      }

      return;
    }

    case 'resourceGrant': {
      const amount = sideEffectAmount(runtime, action.amount, context.skill);
      if (action.resource === 'endurance') runtime.endurance.grant(amount);
      else runtime.resourceController.grant(action.resource, amount);
      return;
    }

    case 'flipArm':
      if (context.kind !== 'cast') throw new TypeError('flipArm requires a cast trigger.');
      runtime.armFlip(action.skillId, {
        expiresAt:
          action.durationSec === null
            ? Infinity
            : runtime.time + sideEffectAmount(runtime, action.durationSec ?? Number(context.skill.flipDuration)),
        // Some follow-ups must expire before same-time cast work, matching their previous lifecycle owner.
        expiryPriority: action.expiryPriority
      });
      return;
    case 'flipConsume':
      // Consumption is phase-owned by the declaration and leaves any later rearm's expiry independent.
      if (context.kind !== 'cast') throw new TypeError('flipConsume requires a cast trigger.');
      runtime.consumeFlip(action.skillId);
      return;
    case 'emitProfile': {
      const profile = requireBalanceProfileFromContext(runtime, action.profileId);
      emitEffects(runtime, {
        owner: profile,
        effects: action.effects ? (profile.effects ?? []).filter(action.effects) : undefined,
        cause: context.kind === 'effect' ? context.trigger.event : undefined,
        baseEvent: {
          source: 'Trait',
          sourceId: action.profileId,
          actorType: 'effect',
          skillId: context.kind === 'cast' ? context.skill.id : context.trigger.event.skillId,
          skillName: context.kind === 'cast' ? context.skill.name : context.trigger.event.skillName,
          activationId: context.kind === 'cast' ? context.cast.id : context.trigger.event.activationId,
          ...action.attribution
        },
        transform: (event) => ({ ...event, name: action.attribution?.name ?? event.name })
      });
      return;
    }

    default: {
      const handler = handlers[action.type];
      if (!handler) throw new TypeError(`No side-effect handler registered for ${action.type}.`);
      handler(runtime, context, action);
    }
  }
}

/** The runtime dispatches start rewards for every accepted cast and commit rewards only for successful casts. */
export function applySkillSideEffects(
  runtime: Gw2Runtime,
  cast: RuntimeCast,
  on: SkillSideEffect['on'],
  handlers?: Parameters<typeof applySideEffect>[3]
): void {
  for (const effect of cast.skill.sideEffects ?? []) {
    if (effect.on === on && (!effect.when || effect.when(runtime, cast)))
      applySideEffect(runtime, { kind: 'cast', skill: cast.skill, cast }, effect.do, handlers);
  }
}
