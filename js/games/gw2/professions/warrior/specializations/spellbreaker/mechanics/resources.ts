import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';

/** Spellbreaker supplies its selected cap before the shared controller seeds initial adrenaline. */
export const spellbreakerAdrenalinePolicy: typeof coreAdrenalinePolicy = {
  ...coreAdrenalinePolicy,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks')
};
