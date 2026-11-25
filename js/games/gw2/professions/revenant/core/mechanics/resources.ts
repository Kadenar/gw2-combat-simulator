import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_ENERGY_DEPLETED, revenantUpkeepDrain } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  REVENANT_ENERGY_REGENERATION,
  REVENANT_MAXIMUM_ENERGY,
  REVENANT_PRECOMBAT_ENERGY_CEILING,
  revenantStartingEnergy
} from '#gw2/professions/revenant/core/resource-values.js';
import { enduringRecoveryBonus } from '#gw2/professions/revenant/core/traits/retribution/index.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import { resourceAtLeast } from '#kernel/resources/pool.js';

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

// These skills join upkeep activations in paying their Energy when the cast commits instead of when it starts.
export const energyPaidAtCastCommit: ReadonlySet<SkillId> = new Set([
  ID.TEMPORAL_RIFT,
  ID.ABYSSAL_FORCE,
  ID.ABYSSAL_BLOT,
  ID.HEX_EATER_VORTEX,
  ID.BEGUILING_HAZE,
  ID.BANISH_ENCHANTMENT,
  ID.JADE_WINDS,
  ID.PHASE_TRAVERSAL,
  ID.ENCHANTED_DAGGERS,
  ID.SOOTHING_STONE,
  ID.SCORCHRAZOR,
  ID.SPIRITCRUSH,
  ID.SEVENSHOT,
  // Band Together casts keep these base IDs; their enhanced profiles only supply effects.
  ID.ICERAZORS_IRE,
  ID.RAZORCLAWS_RAGE
]);

/**
 * Pay the cost captured when this cast started. In game, a cast whose payment point finds too little Energy, because
 * another skill spent it or an upkeep drained it during the windup, is cancelled. The simulator has already scheduled
 * that cast's hits and recharge, so it only skips the spend, warns, and marks the cast unpaid for Energy rewards.
 */
export function payPendingEnergy(runtime: RevenantRuntime, castId: string, skillName: string): void {
  const core = runtime.profession.core;
  const cost = core.pendingEnergyCosts[castId];

  if (cost == null) return;

  delete core.pendingEnergyCosts[castId];

  if (resourceAtLeast(runtime.resourceController.value('energy'), cost)) {
    runtime.resourceController.spend('energy', cost);
    return;
  }

  core.unpaidEnergyCasts[castId] = true;
  runtime.combat.warn({
    message: `${skillName} lacks energy at commit; the game cancels this cast.`,
    at: runtime.time,
    activationId: castId,
    cancelsCast: true
  });
}

/** A cast that reached its payment point without enough Energy earns no Energy-linked rewards. */
export function revenantEnergyUnpaid(runtime: MechanicQueriesOf<RevenantRuntime>, castId: string): boolean {
  return Object.hasOwn(runtime.profession.core.unpaidEnergyCasts, castId);
}

/** Energy readiness respects precombat recovery and the shared action grid before allowing a cast. */
export function revenantEnergyAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult {
  const core = runtime.profession.core;
  const now = runtime.time;
  const cost = revenantEnergyCost(runtime, skill);
  // Casts still winding up hold nothing; whichever cast pays first takes the Energy.
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
