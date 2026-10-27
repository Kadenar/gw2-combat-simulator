import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { balanceNumberFromContext, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Base initiative is fixed; trait and skill adjustments retain their own patchable tuning. */
export const INITIATIVE = Object.freeze({ maximum: 12, regenerationPerSecond: 1 });

/** Construction, runtime, and presentation share Preparedness's selected capacity or the fixed base maximum. */
export function thiefInitiativeCapacity(context: unknown): number {
  return hasTrait(context, TRAIT.PREPAREDNESS)
    ? balanceNumberFromContext(context, TRAIT.PREPAREDNESS, 'maximumStacks')
    : INITIATIVE.maximum;
}

/**
 * Starting initiative shared by state construction and runtime initialization. An omitted or NaN value starts at the
 * fixed base capacity: Preparedness raises only the ceiling, never the starting amount. Explicit values, zero and
 * fractions included, are clamped into the build's capacity.
 */
export function thiefStartingInitiative(config: Pick<ThiefConfig, 'initialInitiative'>, maximum: number): number {
  const initial = INITIATIVE.maximum;
  return boundedNumber(config.initialInitiative ?? initial, initial, 0, maximum);
}

/** Fixed base regeneration combines with the selected Kneel bonus only while kneeling. */
export function thiefInitiativeRegenerationRate(state: Pick<ThiefCoreState, 'kneeling'>, context: unknown): number {
  return (
    INITIATIVE.regenerationPerSecond +
    (state.kneeling ? skillNumberFromContext(context, ID.KNEEL, 'kneelingInitiativeRegenerationBonus') : 0)
  );
}

/** Initiative shares the platform lifecycle while kneeling and Preparedness remain Thief rules. */
export const thiefInitiative: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.initiative,
  maximum: thiefInitiativeCapacity,
  initial: (runtime, maximum) => thiefStartingInitiative(runtime.config as ThiefConfig, maximum),
  recovery: (runtime) => thiefInitiativeRegenerationRate(runtime.profession.core, runtime),
  // Besides regeneration, the pending signet pulse and the running cast's completion are the known grant boundaries.
  nextChange(runtime, cost) {
    if (cost > runtime.profession.core.initiative.maximum) return Infinity;

    const pulse = runtime.profession.core.infiltratorsSignetPassive.nextAt;
    const completion = runtime.castController.currentLaneEnd();
    return Math.min(pulse > runtime.time ? pulse : Infinity, completion > runtime.time ? completion : Infinity);
  }
};

/** Core uses shared recovery; Daredevil replaces only the capacity with its third dodge. */
export const thiefEndurance: EndurancePolicy<ThiefRuntime> = {
  state: (runtime) => runtime.profession.core.endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationRate: (_runtime, vigor) =>
    Math.min(ENDURANCE.maximumRegenerationPerSecond, enduranceRegenerationRate(vigor))
};

/** Kneeling changes the regeneration rate from this instant onward. */
export function setThiefKneeling(runtime: ThiefRuntime, kneeling: boolean): void {
  runtime.profession.core.kneeling = kneeling;
  runtime.resourceController.refresh('initiative');
}
