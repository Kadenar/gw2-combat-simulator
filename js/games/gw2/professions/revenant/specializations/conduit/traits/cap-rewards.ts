import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';

/** Reward a selected cap crossing once; further grants at full affinity cannot repeat the Energy gain. */
export function grantExpandedConsciousness(runtime: RevenantRuntime, previous: number, maximum: number): void {
  if (
    previous < maximum &&
    runtime.resourceController.value('affinity') === maximum &&
    hasTrait(runtime, TRAIT.EXPANDED_CONSCIOUSNESS)
  )
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.expandedConsciousness), 'resourceGain')
    );
}
