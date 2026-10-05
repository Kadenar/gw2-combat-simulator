import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';

let defaultCatalog: ReturnType<typeof createCanonicalCatalog> | undefined;

/** Validate defaults once after module composition; runtime initialization still applies the selected patch. */
export function createFirebrandState(config: GuardianConfig = {}) {
  const catalog = (defaultCatalog ??= createCanonicalCatalog({
    balanceProfiles: [
      ...FIREBRAND_BALANCE_PROFILES,
      ...firebrandTraits.map((trait) => defineTraitProfile(trait.id, trait.name, trait.balance))
    ]
  }));
  const profileContext = {
    config,
    balanceProfile: (id: string | number) => catalog.balanceProfilesById.get(id)
  };
  return firebrandState.create(profileContext);
}
