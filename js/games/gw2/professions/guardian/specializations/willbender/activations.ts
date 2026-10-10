import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianVirtue } from '#gw2/professions/guardian/types.js';

/** A virtue window boundary; the cause is the activation or the hit that completed a cycle. */
export interface WillbenderVirtueBoundary {
  readonly cause: Gw2ResolverEvent;
  readonly virtue: GuardianVirtue;
}

/** Activation rewards run after the mechanic installs the virtue window and before any later hit. */
export const willbenderVirtueOpened = defineTriggerPoint<WillbenderVirtueBoundary>(
  'guardian.willbender-virtue-opened',
  [TRAIT.LETHAL_TEMPO, TRAIT.HOLY_RECKONING, TRAIT.RESTORATIVE_VIRTUES, TRAIT.PHOENIX_PROTOCOL]
);

/**
 * Completed hit cycles grant Tempo, Might, and recharge reduction before the virtue's own effects. Phoenix Protocol
 * rewards only Resolve, whose cycle has no virtue effects of its own, so its listener closes the list.
 */
export const willbenderVirtueTriggered = defineTriggerPoint<WillbenderVirtueBoundary>(
  'guardian.willbender-virtue-triggered',
  [TRAIT.LETHAL_TEMPO, TRAIT.HOLY_RECKONING, TRAIT.RESTORATIVE_VIRTUES, TRAIT.PHOENIX_PROTOCOL]
);
