import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

export interface ElementalistReaction {
  readonly cause: Gw2ResolverEvent;
}
/** Accepted player control grants Lightning Rod before the attunement-specific Lockdown reward. */
export const controlAccepted = defineTriggerPoint<ElementalistReaction>('elementalist.control-accepted', [
  TRAIT.LIGHTNING_ROD,
  TRAIT.ELEMENTAL_LOCKDOWN
]);

/** Aura state and observation precede Air, Earth, then Tempest rewards for both skill and combo auras. */
export const auraAccepted = defineTriggerPoint<ElementalistReaction>('elementalist.aura-accepted', [
  TRAIT.ZEPHYRS_BOON,
  TRAIT.ELEMENTAL_SHIELDING,
  TRAIT.TEMPESTUOUS_ARIA,
  TRAIT.INVIGORATING_TORRENTS,
  TRAIT.ELEMENTAL_BASTION
]);

export interface ElementalistCastCompleted {
  readonly cast: RuntimeCast<ElementalistSkill>;
}

/** Completed skill rewards settle in the established Fire, Earth, Water, Earth, Air, Arcane order. */
export const elementalistCastCompleted = defineTriggerPoint<ElementalistCastCompleted>('elementalist.cast-completed', [
  TRAIT.PYROMANCERS_PUISSANCE,
  TRAIT.EARTHS_EMBRACE,
  TRAIT.SOOTHING_ICE,
  TRAIT.WRITTEN_IN_STONE,
  TRAIT.INSCRIPTION,
  TRAIT.ARCANE_LIGHTNING
]);

export interface ElementalistDamageResolved extends ElementalistReaction {
  readonly details: NativeResolvedDamageDetails;
}

/** Fresh Air settles before critical rewards, which precede weapon and field reactions. */
export const elementalistDamageResolved = defineTriggerPoint<ElementalistDamageResolved>(
  'elementalist.damage-resolved',
  [
    TRAIT.FRESH_AIR,
    TRAIT.RAGING_STORM,
    TRAIT.ARCANE_PRECISION,
    TRAIT.RENEWING_STAMINA,
    TRAIT.BURNING_PRECISION,
    TRAIT.PERSISTING_FLAMES
  ]
);

/** Preparing future damage lets Fresh Air register scheduler wakes without predicting a critical result. */
export const elementalistEventPreparing = defineTriggerPoint<{ readonly event: SimulationEventBase }>(
  'elementalist.event-preparing',
  [TRAIT.FRESH_AIR]
);

/** Accepted conditions grant Strength of Stone before the Burning field reward. */
export const elementalistConditionApplied = defineTriggerPoint<ElementalistReaction>('elementalist.condition-applied', [
  TRAIT.STRENGTH_OF_STONE,
  TRAIT.PERSISTING_FLAMES
]);

/** A paid dodge resolves its attunement proc before Arcane Echo and ordinary completion rewards. */
export const elementalistDodgeCompleted = defineTriggerPoint<ElementalistCastCompleted>(
  'elementalist.dodge-completed',
  [TRAIT.EVASIVE_ARCANA]
);

/** A conjure grants its aura after equipping both copies and before publishing the weapon swap. */
export const conjureEquipped = defineTriggerPoint<ElementalistCastCompleted>('elementalist.conjure-equipped', [
  TRAIT.CONJURER
]);
