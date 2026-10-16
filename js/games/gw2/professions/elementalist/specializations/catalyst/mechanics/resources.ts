import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { sphereSpecialistAllowsEnergy } from '#gw2/professions/elementalist/specializations/catalyst/traits/spheres.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Energy has no passive recovery: accepted hits and attunement traits grant at their owned event boundaries. */
export const catalystEnergyPolicy: ResourcePolicy<ElementalistRuntime> = {
  kind: 'continuous',
  state: (runtime) => catalystState.from(runtime).catalystEnergy,
  maximum: (runtime) => balanceNumberFromContext(runtime, PROFILE.resources, 'maximumStacks'),
  initial: (runtime, maximum) => runtime.config.initialCatalystEnergy ?? maximum,
  recovery: () => 0
};

/** Only accepted non-summon strikes grant energy, using the sphere window at impact. */
export function gainCatalystEnergy(runtime: ElementalistRuntime, event: SimulationEvent): void {
  const state = catalystState.from(runtime);

  if (
    event.actorType === 'summon' ||
    !(Number(event.coefficient) > 0) ||
    (runtime.time < state.sphereActiveUntil && !sphereSpecialistAllowsEnergy(runtime))
  )
    return;

  const before = runtime.resourceController.value('catalystEnergy');
  runtime.resourceController.grant(
    'catalystEnergy',
    balanceNumberFromContext(runtime, PROFILE.resources, 'resourceGain')
  );
  const after = runtime.resourceController.value('catalystEnergy');

  if (after !== before)
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
        type: 'resource',
        at: runtime.time,
        source: 'Catalyst Energy',
        sourceId: event.sourceId,
        actorType: 'player',
        skillName: event.skillName,
        kind: 'catalyst-energy',
        value: after,
        maximum: state.catalystEnergy.maximum,
        change: after - before
      }
    });
}
