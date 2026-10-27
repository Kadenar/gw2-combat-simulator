import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import type { EndurancePolicy, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_ENERGY_DEPLETED, revenantUpkeepDrain } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  REVENANT_MAXIMUM_ENERGY,
  REVENANT_PRECOMBAT_ENERGY_CEILING,
  REVENANT_ENERGY_REGENERATION,
  revenantStartingEnergy
} from '#gw2/professions/revenant/core/resource-values.js';
import { enduringRecoveryBonus } from '#gw2/professions/revenant/core/traits/retribution/index.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';

/** Capacity is distinct from the precombat recovery ceiling, which never discards larger grants. */
export const revenantEnergy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.energy,
  maximum: () => REVENANT_MAXIMUM_ENERGY,
  initial: (runtime) => revenantStartingEnergy(runtime.config as RevenantConfig),
  recovery: (runtime) => REVENANT_ENERGY_REGENERATION - revenantUpkeepDrain(runtime),
  recoveryMaximum: (runtime) =>
    runtime.profession.core.combatBeganAt == null ? REVENANT_PRECOMBAT_ENERGY_CEILING : REVENANT_MAXIMUM_ENERGY,
  // Starvation keeps its place before upkeep pulses while the resource controller replaces obsolete wakes.
  depletion: { task: REVENANT_ENERGY_DEPLETED, priority: -300 }
};

/** Vigor and Enduring Recovery add together; Vindicator shares the ten-per-second cap. */
export function revenantEnduranceRate(runtime: RevenantRuntime, vigor: boolean): number {
  return Math.min(
    ENDURANCE.maximumRegenerationPerSecond,
    enduranceRegenerationRate(vigor, enduringRecoveryBonus(runtime))
  );
}

export const revenantEndurance: EndurancePolicy<RevenantRuntime> = {
  state: (runtime) => runtime.profession.core.endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (runtime, vigor) => revenantEnduranceRate(runtime, vigor)
};

/** Energy readiness respects precombat recovery and the shared action grid before allowing a cast. */
export function revenantEnergyAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult {
  const core = runtime.profession.core;
  const now = runtime.time;
  const cost = revenantEnergyCost(runtime, skill);
  const energy = runtime.resourceController.value('energy');
  const energyReadyAt =
    !resourceAtLeast(energy, cost) && core.combatBeganAt == null
      ? null
      : runtime.resourceController.readyAt('energy', cost);

  // A fractional balance can cross a cost between action ticks; wait until the shared grid permits spending it.
  if (!resourceAtLeast(energy, cost) || (energyReadyAt != null && energyReadyAt > now)) {
    const cooldownReadyAt = runtime.cooldownController.readyAt(skill.id) || 0;
    return denySkillCast(
      skill,
      'revenant.insufficient-energy',
      `requires ${cost} energy.`,
      cooldownReadyAt > now ? cooldownReadyAt : energyReadyAt
    );
  }

  return { ready: true };
}
