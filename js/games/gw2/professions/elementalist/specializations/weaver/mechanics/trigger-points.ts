import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
export interface WeaverTransition {
  readonly event: SimulationEvent;
}
export interface WeaverCastCompleted extends ElementalistCastCompleted {
  readonly dualAttunements: readonly ElementalistAttunement[] | null;
}
export interface WeaverUnraveled extends ElementalistCastCompleted {
  readonly previousPrimary: string;
  readonly previousSecondary: string | null;
}
/** Both starting hands are assigned before the opener's Elements of Rage window is seeded. */
export const weaverHandsInitialized = defineTriggerPoint<{ readonly at: number }>(
  'elementalist.weaver-hands-initialized',
  [TRAIT.ELEMENTS_OF_RAGE]
);
/** Fully attuned entry grants Rage before Weave Self consumes the transition. */
export const weaverHandsChanged = defineTriggerPoint<WeaverTransition>('elementalist.weaver-hands-changed', [
  TRAIT.ELEMENTS_OF_RAGE
]);
/** In-combat entry grants Resistance after Weave Self and before Core's hand-count reward. */
export const weaverAttunementCompleted = defineTriggerPoint<WeaverTransition>(
  'elementalist.weaver-attunement-completed',
  [TRAIT.WEAVERS_PROWESS]
);
/** Completion settles stance, per-element rewards, then the dual-attack cooldown before Fervent Stance. */
export const weaverCastCompleted = defineTriggerPoint<WeaverCastCompleted>('elementalist.weaver-cast-completed', [
  TRAIT.BOLSTERED_ELEMENTS,
  TRAIT.SWIFT_REVENGE,
  TRAIT.SUPERIOR_ELEMENTS
]);
/** Unravel captures both old hands before unifying them and granting its transition reward. */
export const weaverUnraveled = defineTriggerPoint<WeaverUnraveled>('elementalist.weaver-unraveled', [
  TRAIT.ELEMENTS_OF_RAGE
]);
