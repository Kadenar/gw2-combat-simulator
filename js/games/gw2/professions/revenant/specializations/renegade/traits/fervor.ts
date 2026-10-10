import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';

export function fervorProfile(runtime: RevenantRuntime): BalanceProfile {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.LASTING_LEGACY) ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor
  );
}
