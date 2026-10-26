import { ELEMENTALIST_TRAIT_IDS as CATALYST_TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { sphereSpecialistAllowsEnergy } from '#gw2/professions/elementalist/specializations/catalyst/traits/spheres.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Energy has no passive recovery: accepted hits and attunement traits grant at their owned event boundaries. */
export const catalystEnergyPolicy: ResourcePolicy<ElementalistRuntime> = {
  kind: 'continuous',
  state: (runtime) => catalystState.from(runtime).catalystEnergy,
  maximum: (runtime) => balanceNumberFromContext(runtime, CATALYST_TRAIT.DEPTH_OF_ELEMENTS, 'maximumStacks'),
  initial: (runtime, maximum) => runtime.config.initialCatalystEnergy ?? maximum,
  recovery: () => 0
};

/** Only accepted non-summon strikes grant energy, using the sphere window at impact. */
export function gainCatalystEnergy(runtime: ElementalistRuntime, event: SimulationEvent): void {
  const state = catalystState.from(runtime);

  if (
    event.actorType === ACTOR.SUMMON ||
    !(Number(event.coefficient) > 0) ||
    (runtime.time < state.sphereActiveUntil && !sphereSpecialistAllowsEnergy(runtime))
  )
    return;

  const before = runtime.resourceController.value('catalystEnergy');
  runtime.resourceController.grant(
    'catalystEnergy',
    balanceNumberFromContext(runtime, CATALYST_TRAIT.DEPTH_OF_ELEMENTS, 'resourceGain')
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
        actorType: ACTOR.PLAYER,
        skillName: event.skillName,
        kind: 'catalyst-energy',
        value: after,
        maximum: state.catalystEnergy.maximum,
        change: after - before
      }
    });
}
