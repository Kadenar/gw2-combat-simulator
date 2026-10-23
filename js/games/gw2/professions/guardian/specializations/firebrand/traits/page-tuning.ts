import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

/** Traits choose capacity, initial default, and cadence; the resource controller owns page accounting. */
export function firebrandPageTuning(context: { readonly config: GuardianConfig }) {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const capacityTrait = resourcesProfile.capacityTrait as SkillId | undefined;
  const intervalTrait = resourcesProfile.intervalTrait as SkillId | undefined;
  const enhancedCapacity = capacityTrait !== undefined && hasTrait(context, capacityTrait);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = enhancedCapacity
    ? balanceNumberFromContext(context, capacityTrait, 'maximumStacks')
    : defaultMaximum;
  const interval =
    intervalTrait !== undefined && hasTrait(context, intervalTrait)
      ? balanceNumberFromContext(context, intervalTrait, 'pulseInterval')
      : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  return {
    maximum: traitMaximum,
    // Default to capacity only when no starting value was supplied; explicit values remain player-owned.
    initial: context.config.initialTomePages ?? traitMaximum,
    interval
  };
}
