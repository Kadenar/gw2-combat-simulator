import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Samples pre-swap Energy before the legend reset is applied. */
export function chargedMistsEnergy(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  previous: number
): number {
  const chargedMists = hasTrait(runtime, TRAIT.CHARGED_MISTS)
    ? requireBalanceProfileFromContext(runtime, TRAIT.CHARGED_MISTS)
    : undefined;
  const energy = Math.min(
    100,
    chargedMists && Math.floor(previous) <= balanceProfileNumber(chargedMists, 'threshold')
      ? balanceProfileNumber(chargedMists, 'resourceGain')
      : cast.skill.resourceGain || 0
  );
  return energy;
}
