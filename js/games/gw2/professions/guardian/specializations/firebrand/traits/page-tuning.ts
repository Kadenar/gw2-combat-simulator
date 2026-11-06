import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceNumber,
  balanceProfileNumber,
  requireBalanceProfile,
  type BalanceProfileSource
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

/** Traits choose capacity, initial default, and cadence; the resource controller owns page accounting. */
export function firebrandPageTuning(context: {
  readonly config: GuardianConfig;
  readonly traits?: ReadonlySet<SkillId>;
  readonly catalog: BalanceProfileSource;
}) {
  const resourcesProfile = requireBalanceProfile(context.catalog, TRAIT.PURITY_OF_WORD);
  const capacityTrait = resourcesProfile.capacityTrait as SkillId | undefined;
  const intervalTrait = resourcesProfile.intervalTrait as SkillId | undefined;
  const enhancedCapacity = capacityTrait !== undefined && hasTrait(context, capacityTrait);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = enhancedCapacity
    ? balanceNumber(context.catalog, capacityTrait, 'maximumStacks')
    : defaultMaximum;
  const interval =
    intervalTrait !== undefined && hasTrait(context, intervalTrait)
      ? balanceNumber(context.catalog, intervalTrait, 'pulseInterval')
      : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  return {
    maximum: traitMaximum,
    // Default to capacity only when no starting value was supplied; explicit values remain player-owned.
    initial: context.config.initialTomePages ?? traitMaximum,
    interval
  };
}
