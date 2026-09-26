import type { EffectEventBase } from '#gw2/platform/engine/effects/materializer.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';

export type ProfileAmount = number | { readonly profile: SkillId; readonly field: string };
export type SideEffectAction =
  | { readonly type: 'rechargeReset'; readonly skillIds: readonly SkillId[] }
  | { readonly type: 'ammoRestore'; readonly skillIds: readonly SkillId[]; readonly count: ProfileAmount }
  | { readonly type: 'resourceGrant'; readonly resource: ResourceKey | 'endurance'; readonly amount: ProfileAmount }
  | { readonly type: 'flipArm'; readonly skillId: SkillId; readonly durationSec?: ProfileAmount }
  | { readonly type: 'emitProfile'; readonly profileId: SkillId; readonly attribution?: Partial<EffectEventBase> }
  | { readonly type: `${string}.${string}`; readonly amount?: ProfileAmount };

export interface SkillSideEffect {
  readonly on: 'castStart' | 'castCommit' | 'castComplete';
  readonly order?: number;
  readonly when?: (runtime: Gw2Runtime, cast: RuntimeCast) => boolean;
  readonly do: SideEffectAction;
}

/** Resolve live patch data at the point of application, rejecting invalid amounts before mutating a pool. */
export function sideEffectAmount(runtime: Gw2Runtime, amount: ProfileAmount): number {
  const value =
    typeof amount === 'number'
      ? amount
      : balanceProfileNumber(requireBalanceProfileFromContext(runtime, amount.profile), amount.field);
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError('Side-effect amounts must be finite and non-negative.');
  return value;
}

/** The platform owns ordinary pool and packet mutations; named profession verbs retain state-machine ownership. */
export function applySideEffect(
  runtime: Gw2Runtime,
  cast: RuntimeCast,
  action: SideEffectAction,
  handlers: Readonly<
    Record<string, (runtime: Gw2Runtime<any>, cast: RuntimeCast, action: SideEffectAction) => void>
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
      const amount = sideEffectAmount(runtime, action.amount);
      if (action.resource === 'endurance') runtime.endurance.grant(amount);
      else runtime.resourceController.grant(action.resource, amount);
      return;
    }

    case 'flipArm':
      runtime.armFlip(action.skillId, {
        expiresAt: runtime.time + sideEffectAmount(runtime, action.durationSec ?? Number(cast.skill.flipDuration))
      });
      return;
    case 'emitProfile':
      emitEffects(runtime, {
        owner: requireBalanceProfileFromContext(runtime, action.profileId),
        baseEvent: {
          source: 'Trait',
          sourceId: action.profileId,
          actorType: 'effect',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id,
          ...action.attribution
        }
      });
      return;
    default: {
      const handler = handlers[action.type];
      if (!handler) throw new TypeError(`No side-effect handler registered for ${action.type}.`);
      handler(runtime, cast, action);
    }
  }
}

/** Start rewards survive cancellation, commit rewards require commitment, and completion rewards require a full cast. */
export function applySkillSideEffects(
  runtime: Gw2Runtime,
  cast: RuntimeCast,
  on: SkillSideEffect['on'],
  handlers?: Parameters<typeof applySideEffect>[3]
): void {
  if ((on === 'castCommit' && cast.cancelled) || (on === 'castComplete' && !castCompleted(cast))) return;
  for (const effect of cast.skill.sideEffects ?? []) {
    if (effect.on === on && (!effect.when || effect.when(runtime, cast)))
      applySideEffect(runtime, cast, effect.do, handlers);
  }
}
