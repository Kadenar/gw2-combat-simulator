import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

// Separate from the pool policy in resources.ts: passives grant life force while that policy reads passive timing.

/** Grants accepted outcomes directly to the current pool, applying percentage capacity and Gluttony once. */
export function grantNecromancerLifeForce(runtime: NecromancerRuntime, percent: number): void {
  if (!(percent > 0)) return;
  const multiplier = hasTrait(runtime, TRAIT.GLUTTONY)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.GLUTTONY), 'lifeForceGainMultiplier')
    : 1;
  runtime.resourceController.grant(
    'lifeForce',
    ((percent * runtime.profession.core.lifeForce.maximum) / 100) * multiplier
  );
}
