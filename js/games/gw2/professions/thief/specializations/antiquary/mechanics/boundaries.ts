import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/**
 * Antiquary trigger points. They live in this leaf module because the artifact mechanics read trait value queries,
 * and trait files must be able to name a point without importing those mechanics.
 */

/** A committed artifact, with the slot its acceptance spent. */
export interface ArtifactActivation {
  readonly cast: RuntimeCast<ThiefSkill>;
  readonly slot: ThiefArtifactSlot | undefined;
}

/** Family traits react before the artifact grants its identity window. */
export const artifactActivated = defineTriggerPoint<ArtifactActivation>('thief.artifact-activated', [
  TRAIT.ENTERPRISING_ARISTOCRAT,
  TRAIT.EXHILARATING_EPHEMERA,
  TRAIT.POSSESSIVE_HOARDER,
  TRAIT.METICULOUS_CUSTODIAN
]);

/** A committed artifact, after its identity window. */
export interface ArtifactCompletion {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** Repeat Ransacker follows the artifact identity grant. */
export const artifactCompleted = defineTriggerPoint<ArtifactCompletion>('thief.artifact-completed', [
  TRAIT.REPEAT_RANSACKER
]);

/** A live pilfer after the new artifact pool is stored and spending resets. */
export interface ArtifactPilfer {
  readonly source: 'swipe' | 'initiative' | 'scuffle';
}

/** Only Swipe pilfers refresh Scoundrel's Luck before Combat High restarts its staggered stacks. */
export const artifactsPilfered = defineTriggerPoint<ArtifactPilfer>('thief.artifacts-pilfered', [
  TRAIT.SCOUNDRELS_LUCK,
  TRAIT.COMBAT_HIGH
]);

/** A landed strike while Antiquary is selected. */
export interface AntiquaryStrike {
  readonly cause: Gw2ResolverEvent;
}

/** Sun Crystal's Burning attaches at the landed strike, before Mistburn charge consumption. */
export const antiquaryStruck = defineTriggerPoint<AntiquaryStrike>('thief.antiquary-strike', [
  TRAIT.METICULOUS_CUSTODIAN
]);
