import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

/** Traits choose capacity, initial default, and cadence; the resource controller owns page accounting. */
export function firebrandPageTuning(context: { readonly config: GuardianConfig }) {
  const archivistOfWhispers = hasTrait(context, TRAIT.ARCHIVIST_OF_WHISPERS);

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = archivistOfWhispers
    ? balanceNumberFromContext(context, TRAIT.ARCHIVIST_OF_WHISPERS, 'maximumStacks')
    : defaultMaximum;
  const interval = hasTrait(context, TRAIT.LOREMASTER)
    ? balanceNumberFromContext(context, TRAIT.LOREMASTER, 'pulseInterval')
    : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  return {
    maximum: traitMaximum,
    // Default to capacity only when no starting value was supplied; explicit values remain player-owned.
    initial: context.config.initialTomePages ?? traitMaximum,
    interval
  };
}
