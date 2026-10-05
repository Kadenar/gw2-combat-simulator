import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Energy has no passive recovery: accepted hits and attunement traits grant at their owned event boundaries. */
export const catalystEnergyPolicy: ResourcePolicy<ElementalistRuntime> = {
  kind: 'continuous',
  state: (runtime) => catalystState.from(runtime).catalystEnergy,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: (runtime, maximum) => runtime.config.initialCatalystEnergy ?? maximum,
  recovery: () => 0
};
