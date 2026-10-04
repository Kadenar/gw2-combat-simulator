import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import type { WarriorResourcePolicy } from '#gw2/professions/warrior/core/mechanics/resource-policy.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Accepted gains mutate the current pool immediately, capped by its owning specialization. */
export function grantAdrenaline(runtime: WarriorRuntime, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0)
    throw new RangeError('Adrenaline grants must be finite and non-negative.');
  const state = runtime.profession.core;
  state.adrenaline = Math.min(state.maximumAdrenaline, state.adrenaline + amount);
}

// Immutable reservation facts survive resource changes during the cast.
export const warriorBurstSpends = new WeakMap<RuntimeCast<WarriorSkill>, number>();

/** Tier-dependent packets and fields use the same activation-time resource thresholds. */
export function warriorBurstTier(runtime: MechanicQueriesOf<MechanicContext>, spent: number): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.burstTiers);
  return spent >= balanceProfileNumber(profile, 'maximumStacks')
    ? 3
    : spent >= balanceProfileNumber(profile, 'threshold')
      ? 2
      : 1;
}

/** Core bursts reserve the whole live pool; elite policies explicitly select different spending. */
export const coreAdrenalinePolicy: WarriorResourcePolicy = {
  grant: grantAdrenaline,
  hitGain: grantAdrenaline,
  burstSpend: (runtime) => runtime.profession.core.adrenaline,
  spendBurst(runtime, amount) {
    runtime.profession.core.adrenaline -= amount;
  },
  availability(runtime, skill) {
    const state = runtime.profession.core;
    const cost = skill.adrenalineCost ?? 0;
    if (state.adrenaline < cost)
      return {
        ready: false,
        retryAt:
          cost <= state.maximumAdrenaline &&
          state.nextSignetPulseAt > runtime.time &&
          Number.isFinite(state.nextSignetPulseAt)
            ? state.nextSignetPulseAt
            : null,
        code: 'warrior.adrenaline',
        reason: `${skill.name} requires ${cost} adrenaline.`
      };
    return { ready: true };
  },

  reset(runtime) {
    runtime.profession.core.adrenaline = runtime.profession.core.maximumAdrenaline;
  }
};
