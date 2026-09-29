import { defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

/** Supplies canonical default profiles before runtime initialization applies the active patch. */
export function createFirebrandState(config: GuardianConfig = {}) {
  const profileContext = {
    config,
    balanceProfile: (id: string | number) => {
      const trait = firebrandTraits.find((trait) => trait.id === id);
      return trait
        ? defineTraitProfile(trait.id, trait.name, trait.balance)
        : FIREBRAND_BALANCE_PROFILES.find((profile) => profile.id === id);
    }
  };
  return firebrandState.create(profileContext);
}
