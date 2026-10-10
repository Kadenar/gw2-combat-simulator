import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
/** A deployed sphere grants its selected trait payload before authored sphere packets are materialized. */
export const sphereDeployed = defineTriggerPoint<ElementalistCastCompleted>('elementalist.sphere-deployed', [
  TRAIT.SPECTACULAR_SPHERE
]);
/** Actual attunement transitions refund energy, grant Fury, then publish the resulting resource change. */
export const catalystTransitionObserved = defineTriggerPoint<{ readonly event: SimulationEvent }>(
  'elementalist.catalyst-transition-observed',
  [TRAIT.ENERGIZED_ELEMENTS]
);

/** Combat entry admits baseline empowerment once; its background task owns subsequent renewal. */
export const catalystCombatStarted = defineTriggerPoint<Record<string, never>>('elementalist.catalyst-combat-started', [
  TRAIT.ELEMENTAL_EMPOWERMENT
]);
