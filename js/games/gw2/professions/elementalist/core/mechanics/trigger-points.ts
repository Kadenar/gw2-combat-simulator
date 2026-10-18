import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

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

export interface ElementalistEntry {
  readonly at: number;
  readonly skill: Skill;
  readonly target: ElementalistAttunement;
  /** Invoked by eligible compiled listeners, so disabled or unselected traits cannot claim cooldowns. */
  readonly claimTrait: (attunement: ElementalistAttunement, profileId: Skill['id']) => boolean;
  readonly emissionCast?: EffectDelivery['cast'];
}

export interface ElementalistAttunementChanged extends ElementalistEntry {
  readonly previous: ElementalistAttunement;
  readonly dualAttunement: boolean;
}

export interface ElementalistAttunementCount {
  readonly at: number;
  readonly sourceId: Skill['id'];
  readonly stacks: number;
  readonly emissionCast?: EffectDelivery['cast'];
}

/** A real swap settles Fire exit, elemental entry, then Arcane rewards with elite cooldown admission deferred to each selected listener. */
export const attunementChanged = defineTriggerPoint<ElementalistAttunementChanged>('elementalist.attunement-changed', [
  TRAIT.PYROMANCERS_PUISSANCE,
  TRAIT.SUNSPOT,
  TRAIT.ELECTRIC_DISCHARGE,
  TRAIT.FRESH_AIR,
  TRAIT.ONE_WITH_AIR,
  TRAIT.INSCRIPTION,
  TRAIT.EARTHEN_BLAST,
  TRAIT.ROCK_SOLID,
  TRAIT.ARCANE_PROWESS,
  TRAIT.ELEMENTAL_ATTUNEMENT,
  TRAIT.BOUNTIFUL_POWER
]);

/** Overload invocation reaches the same elemental entry attacks without granting swap rewards. */
export const attunementInvoked = defineTriggerPoint<ElementalistEntry>('elementalist.attunement-invoked', [
  TRAIT.SUNSPOT,
  TRAIT.ELECTRIC_DISCHARGE,
  TRAIT.EARTHEN_BLAST
]);

/** Familiar entry preserves its own order: Air movement and Resistance settle before its Fresh Air refresh. */
export const attunementReentered = defineTriggerPoint<ElementalistEntry>('elementalist.attunement-reentered', [
  TRAIT.SUNSPOT,
  TRAIT.ELECTRIC_DISCHARGE,
  TRAIT.ONE_WITH_AIR,
  TRAIT.INSCRIPTION,
  TRAIT.FRESH_AIR,
  TRAIT.EARTHEN_BLAST,
  TRAIT.ROCK_SOLID
]);

/** Completing a Fire overload releases the same Fire-exit payload as a real swap. */
export const attunementReleased = defineTriggerPoint<Omit<ElementalistAttunementCount, 'stacks'>>(
  'elementalist.attunement-released',
  [TRAIT.PYROMANCERS_PUISSANCE]
);

/** Dual-hand mechanics capture the number of changed hands before granting the shared swap-count reward. */
export const attunementsCounted = defineTriggerPoint<ElementalistAttunementCount>('elementalist.attunements-counted', [
  TRAIT.BOUNTIFUL_POWER
]);
