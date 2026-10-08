import type { EndurancePolicy, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { refreshRevenantStarvation, revenantUpkeepDrain } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { enduringRecoveryBonus } from '#gw2/professions/revenant/core/traits/retribution/index.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';

function resourceProfile(runtime: RevenantRuntime) {
  return requireBalanceProfileFromContext(runtime, PROFILE.resources);
}

/** Capacity is distinct from the precombat recovery ceiling, which never discards larger grants. */
export const revenantEnergy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.energy,
  maximum: () => 100,
  initial: (runtime) => (runtime.config as RevenantConfig).initialEnergy ?? 50,
  recovery: (runtime) =>
    balanceProfileNumber(resourceProfile(runtime), 'energyRegenerationPerSecond') - revenantUpkeepDrain(runtime),
  recoveryMaximum: (runtime) => (runtime.profession.core.combatBeganAt == null ? 50 : 100),
  depletion: { refresh: refreshRevenantStarvation, stop: refreshRevenantStarvation }
};

/** Vigor and Enduring Recovery add together; Vindicator shares the ten-per-second cap. */
export function revenantEnduranceRate(runtime: RevenantRuntime, vigor: boolean): number {
  const profile = resourceProfile(runtime);
  const enduring = enduringRecoveryBonus(runtime);
  return Math.min(
    10,
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      ((vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1) + enduring)
  );
}

export const revenantEndurance: EndurancePolicy<RevenantRuntime> = {
  state: (runtime) => runtime.profession.core.endurance,
  maximum: () => REVENANT_MAXIMUM_ENDURANCE,
  regenerationRate: (runtime, vigor) => revenantEnduranceRate(runtime, vigor)
};
