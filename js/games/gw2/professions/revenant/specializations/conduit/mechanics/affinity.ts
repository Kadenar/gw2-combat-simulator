import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Affinity starts empty with no passive recovery; the selected profile retains its minimum-one capacity rule. */
export const conduitAffinityPolicy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => conduitState.from(runtime).affinity,
  maximum: (runtime) =>
    Math.max(1, balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')),
  initial: () => 0,
  recovery: () => 0
};

/** Affinity is combat-only and capped; reaching the cap grants Expanded Consciousness Energy. */
export function gainAffinity(runtime: RevenantRuntime, amount: number): void {
  if (runtime.config.specialization !== 'Conduit' || !runtime.combatStartedAt()) return;
  const state = conduitState.from(runtime);
  const previous = runtime.resourceController.value('affinity');
  runtime.resourceController.grant('affinity', amount);
  grantExpandedConsciousness(runtime, previous, state.affinity.maximum);
}

/** Reward a selected cap crossing once; further grants at full affinity cannot repeat the Energy gain. */
function grantExpandedConsciousness(runtime: RevenantRuntime, previous: number, maximum: number): void {
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
