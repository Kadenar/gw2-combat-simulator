import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

/** Traits choose capacity, initial default, and cadence; the resource controller owns page accounting. */
export function firebrandPageTuning(context: { readonly config: GuardianConfig }) {
  const archivistOfWhispers = hasTrait(context, TRAIT.ARCHIVIST_OF_WHISPERS);

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const defaultMaximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  const traitMaximum = archivistOfWhispers
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCHIVIST_OF_WHISPERS), 'maximumStacks')
    : defaultMaximum;
  const interval = hasTrait(context, TRAIT.LOREMASTER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LOREMASTER), 'pulseInterval')
    : balanceProfileNumber(resourcesProfile, 'pulseInterval');
  const initial = context.config.initialTomePages ?? traitMaximum;
  return {
    maximum: traitMaximum,
    initial: archivistOfWhispers && initial === defaultMaximum ? traitMaximum : initial,
    interval
  };
}
