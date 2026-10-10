import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
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
