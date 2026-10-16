import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Blade critical observations settle Deadly Blades before Jagged Mind with the same resolved critical outcome. */
export const virtuosoBladeCritical = defineTriggerPoint<{
  readonly event: SimulationEvent;
  readonly details: NativeResolvedDamageDetails;
}>('mesmer.blade-critical', [TRAIT.DEADLY_BLADES, TRAIT.JAGGED_MIND]);

/** Initialize Infinite Forge only after the specialization has installed the blade resource lifecycle. */
export const virtuosoInitialized = defineTriggerPoint<{ readonly at: number }>('mesmer.virtuoso-initialized', [
  TRAIT.INFINITE_FORGE
]);
