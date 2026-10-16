import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Healing-skill rewards settle before the elite invocation rewards. */
export const renegadeCastCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.renegade-cast-completed',
  [TRAIT.ASHEN_DEMEANOR]
);

/** Fervor from the actual critical result settles before Razorclaw and Soulcleave. */
export const renegadeStruck = defineTriggerPoint<{
  readonly cause: Gw2ResolverEvent;
  readonly hit?: Gw2HitResolutionContext;
}>('revenant.renegade-struck', [TRAIT.AMBUSH_COMMANDER]);

/** Received Fury advances Fervor at the original boon-reaction boundary. */
export const renegadeBoonApplied = defineTriggerPoint<{ readonly cause: Gw2ResolverEvent }>(
  'revenant.renegade-boon-applied',
  [TRAIT.BLOOD_FURY]
);
