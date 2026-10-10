import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Accepted strike rewards retain life-steal, shroud-slot, critical, then remaining life-steal order. */
export const necromancerStrike = defineTriggerPoint<{
  readonly event: Gw2ResolverEvent;
  readonly details: NativeResolvedDamageDetails;
  readonly firstHit: boolean;
  readonly shroudSkillOne: boolean;
  readonly dhuumfireDuration: number | undefined;
}>('necromancer.strike', [
  TRAIT.VAMPIRIC,
  TRAIT.REAPERS_MIGHT,
  TRAIT.SIPHONED_POWER,
  TRAIT.CHILL_OF_DEATH,
  TRAIT.DHUUMFIRE,
  TRAIT.UNYIELDING_BLAST,
  TRAIT.BARBED_PRECISION,
  TRAIT.VAMPIRIC_PRESENCE
]);

/** Transfers settle before Core strike rewards; the trait-owned Chill follow-up also admits effect actors. */
export const necromancerStrikePreparing = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'necromancer.strike-preparing',
  [TRAIT.PLAGUE_SENDING, TRAIT.CHILL_OF_DEATH]
);

/** Accepted conditions settle Chill and Carapace before disable rewards; Fear of Death remains last. */
export const necromancerConditionApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'necromancer.condition-applied',
  [
    TRAIT.BITTER_CHILL,
    TRAIT.CORRUPTERS_FERVOR,
    TRAIT.CHILLING_DARKNESS,
    TRAIT.DREAD,
    TRAIT.INSIDIOUS_DISRUPTION,
    TRAIT.FEAR_OF_DEATH
  ]
);

/** Hard control shares the disable reward without re-dispatching accepted Fear as a second control. */
export const necromancerControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'necromancer.control-accepted',
  [TRAIT.INSIDIOUS_DISRUPTION]
);

/** Selected listeners contribute before one pool conversion, preserving resource order ahead of transfers. */
export const necromancerStrikeLifeForce = defineTriggerPoint<{
  readonly skill: NecromancerSkill;
  readonly event: Gw2ResolverEvent;
  percent: number;
}>('necromancer.strike-life-force', [TRAIT.SOUL_MARKS, TRAIT.SPITEFUL_FORTITUDE]);
