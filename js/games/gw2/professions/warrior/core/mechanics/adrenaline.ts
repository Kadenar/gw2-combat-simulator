import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

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

/** Adrenaline has no passive rate; readiness retries only at an actual future Signet of Rage pulse. */
export const coreAdrenalinePolicy: ResourcePolicy<WarriorRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.adrenaline,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: (runtime, maximum) => boundedNumber(runtime.config.initialResource ?? 0, 0, 0, maximum),
  recovery: () => 0,
  nextChange(runtime, cost) {
    const state = runtime.profession.core;
    return cost <= state.adrenaline.maximum &&
      state.nextSignetPulseAt > runtime.time &&
      Number.isFinite(state.nextSignetPulseAt)
      ? state.nextSignetPulseAt
      : Infinity;
  }
};
