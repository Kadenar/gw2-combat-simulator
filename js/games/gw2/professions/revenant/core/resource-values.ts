import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/**
 * Energy values shared by state construction and the runtime energy policy. This module stays free of runtime and
 * state imports so the state factory can use it without an import cycle.
 */

/** Energy capacity, distinct from the precombat recovery ceiling. */
export const REVENANT_MAXIMUM_ENERGY = 100;

/** Out of combat, regeneration stops here without discarding larger balances; combat entry lifts it to capacity. */
export const REVENANT_PRECOMBAT_ENERGY_CEILING = 50;

/** Base energy recovery is fixed; active upkeeps subtract their skill-owned drain. */
export const REVENANT_ENERGY_REGENERATION = 5;

/**
 * An omitted or NaN starting value takes the precombat ceiling, where an idle Revenant settles. Explicit values, zero,
 * fractions and amounts above the ceiling included, are clamped into capacity.
 */
export function revenantStartingEnergy(config: Pick<RevenantConfig, 'initialEnergy'>): number {
  return boundedNumber(
    config.initialEnergy ?? REVENANT_PRECOMBAT_ENERGY_CEILING,
    REVENANT_PRECOMBAT_ENERGY_CEILING,
    0,
    REVENANT_MAXIMUM_ENERGY
  );
}
