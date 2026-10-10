import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
export interface EvokerEvent {
  readonly event: SimulationEvent;
}
/** Initialized charges precede the selected fixed-element policy. */
export const evokerInitialized = defineTriggerPoint<{ readonly at: number }>('elementalist.evoker-initialized', [
  TRAIT.SPECIALIZED_ELEMENTS
]);
/** Burning's passive reward follows actual attunement recharge handling and precedes enchantment consumption. */
export const evokerEventAccepted = defineTriggerPoint<EvokerEvent>('elementalist.evoker-event-accepted', [
  TRAIT.EVOCATION
]);
/** After impact mechanics settle, entry progression arms the recharge reward before Dynamo adds charges. */
export const evokerEntryObserved = defineTriggerPoint<EvokerEvent>('elementalist.evoker-entry-observed', [
  TRAIT.ELEMENTAL_BALANCE,
  TRAIT.ELEMENTAL_DYNAMO
]);
/** Completion bookkeeping and weapon charge grants precede Prowess, Blessing, then enchantment grants. */
export const evokerCastCompleted = defineTriggerPoint<ElementalistCastCompleted>('elementalist.evoker-cast-completed', [
  TRAIT.FAMILIARS_PROWESS,
  TRAIT.FAMILIARS_BLESSING,
  TRAIT.GALVANIC_ENCHANTMENT
]);
/** Familiar resource settlement precedes Specialized Elements' recharge and synthetic entry rewards. */
export const familiarSettled = defineTriggerPoint<ElementalistCastCompleted>('elementalist.familiar-settled', [
  TRAIT.SPECIALIZED_ELEMENTS
]);
/** Meditation boons settle after the cast's familiar completion work. */
export const evokerCastSettled = defineTriggerPoint<ElementalistCastCompleted>('elementalist.evoker-cast-settled', [
  TRAIT.ALTRUISTIC_ASPECT
]);
