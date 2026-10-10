import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
export interface TempestTransition {
  readonly event: SimulationEvent;
  readonly emissionCast?: EffectDelivery['cast'];
}
/** Core entry rewards settle before Lucid Singularity schedules the accepted overload's boons. */
export const tempestCastStarted = defineTriggerPoint<ElementalistCastCompleted>('elementalist.tempest-cast-started', [
  TRAIT.LUCID_SINGULARITY
]);
/** Heal rewards precede the completing overload aura, which must settle before the Core Fire-exit reward. */
export const tempestCastCompleting = defineTriggerPoint<ElementalistCastCompleted>(
  'elementalist.tempest-cast-completing',
  [TRAIT.GALE_SONG, TRAIT.UNSTABLE_CONDUIT]
);
/** Shout rewards observe completed overload-specific work. */
export const tempestCastCompleted = defineTriggerPoint<ElementalistCastCompleted>(
  'elementalist.tempest-cast-completed',
  [TRAIT.TEMPESTUOUS_ARIA]
);
/** Normalized attunement transitions grant Water's trait reward after elite mechanic handling. */
export const tempestTransitionObserved = defineTriggerPoint<TempestTransition>(
  'elementalist.tempest-transition-observed',
  [TRAIT.LATENT_STAMINA]
);
