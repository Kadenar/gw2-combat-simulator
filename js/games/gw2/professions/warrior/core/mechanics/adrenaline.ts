import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState>;

/** Accepted gains mutate the current pool immediately, capped by its owning specialization. */
export function grantWarriorAdrenaline(runtime: WarriorRuntime, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0)
    throw new RangeError('Adrenaline grants must be finite and non-negative.');
  // Bladesworn converts authored and trait grants into its single Flow pool.
  const specialization = runtime.profession.specialization;
  if (specialization.kind === 'Bladesworn') {
    const state = specialization.state;
    state.flow = Math.min(state.maximumFlow, state.flow + amount);
    return;
  }

  const state = runtime.profession.core;
  state.adrenaline = Math.min(state.maximumAdrenaline, state.adrenaline + amount);
}

// Immutable reservation facts survive resource changes during the cast.
export const warriorBurstSpends = new WeakMap<RuntimeCast, number>();

/** Tier-dependent packets and fields use the same activation-time resource thresholds. */
export function warriorBurstTier(runtime: Gw2Runtime, spent: number): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.burstTiers);
  return spent >= balanceProfileNumber(profile, 'maximumStacks')
    ? 3
    : spent >= balanceProfileNumber(profile, 'threshold')
      ? 2
      : 1;
}
