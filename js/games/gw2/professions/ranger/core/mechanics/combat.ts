import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';
/** Completion rewards heal and Command traits before Beast-skill completion. */
export const castCompleted = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.cast-completed',
  [TRAIT.CHILD_OF_EARTH, TRAIT.RESOUNDING_TIMBRE]
);
/** The accepted pet or merged Beast skill takes exactly one path, preserving reward order. */
export const beastSkillUsed = defineTriggerPoint<{
  readonly skill: RangerSkill;
  readonly poisonMaster: boolean;
  readonly at: number;
}>('ranger.beast-skill-used', [TRAIT.REJUVENATION, TRAIT.POISON_MASTER, TRAIT.WOLFSONG]);
/** The new pet incarnation is committed before its arrival and warhorn rewards. */
export const petSwapped = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.pet-swapped',
  [TRAIT.SPIRITED_ARRIVAL, TRAIT.CLARION_BOND]
);
/** Committed weapon and elite bar swaps grant boons around the one-use Quick Draw window. */
export const weaponSwapped = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.weapon-swapped',
  [TRAIT.TAIL_WIND, TRAIT.QUICK_DRAW, TRAIT.FURIOUS_GRIP]
);
/** Explicit dodge commitment and evading skill acceptance share the duration-stacking reward. */
export const dodged = defineTriggerPoint<{ readonly at: number }>('ranger.dodged', [TRAIT.LIGHT_ON_YOUR_FEET]);
/** The resolved Beast strike precedes the Lesser Sic Em buff it creates, then skill on-hit effects run. */
export const strike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.strike', [
  TRAIT.OPENING_STRIKE,
  TRAIT.GO_FOR_THE_THROAT,
  TRAIT.HUNTERS_GAZE,
  TRAIT.POISON_MASTER
]);
/** Poisonous Strikes and Sharpening Stone settle before the pet torment reward. */
export const strikeEffectsApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.strike-effects-applied',
  [TRAIT.ARACHNOPHOBIA]
);
/** Strength of the Pack applies before trap rewards, followed by Blood Thirst. */
export const packStrikeApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.pack-strike-applied',
  [TRAIT.TRAPPERS_EXPERTISE]
);
/** The shortbow upgrade follows its Blood Thirst skill effect. */
export const bloodThirstApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.blood-thirst-applied',
  [TRAIT.LIGHT_ON_YOUR_FEET]
);
/** Fury rearms opening strikes before stealth and pet venom state transitions. */
export const buffApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.buff-applied', [
  TRAIT.REMORSELESS
]);
/** The shared resolved critical fact follows on-hit rewards and precedes stealth removal. */
export const criticalResolved = defineTriggerPoint<{
  readonly event: Gw2ResolverEvent;
  readonly details: NativeResolvedDamageDetails;
}>('ranger.critical-resolved', [TRAIT.SHARPENED_EDGES]);
/** An accepted lesser command copies player boons at its Beast impact. */
export const commandApplied = defineTriggerPoint<{ readonly skill: Pick<RangerSkill, 'name'>; readonly at: number }>(
  'ranger.command-applied',
  [TRAIT.RESOUNDING_TIMBRE]
);
/** Merged commands extend player boons without targeting an absent pet. */
export const mergedCommandApplied = defineTriggerPoint<{
  readonly skill: Pick<RangerSkill, 'id' | 'categories'>;
  readonly at: number;
}>('ranger.merged-command-applied', [TRAIT.RESOUNDING_TIMBRE]);
/** Soulbeast claims its first surviving Beast hit once before Core and elite rewards. */
export const mergedBeastHit = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('ranger.merged-beast-hit', [
  TRAIT.LIVE_FAST,
  TRAIT.WILTING_STRIKE,
  TRAIT.GO_FOR_THE_EYES,
  TRAIT.GO_FOR_THE_THROAT
]);
/** An accepted opener consumes readiness once before the selected cripple follow-up. */
export const openingStrikeConsumed = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.opening-strike-consumed',
  [TRAIT.ALPHA_FOCUS]
);
/** Commandable pet Beast skills exclude their independently delivered family skills. */
export function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(skill.petSkill && !skill.petFamilySkill);
}

/** Native initialization admits configured trait loops once; their tasks own subsequent delivery. */
export const rangerInitialized = defineTriggerPoint<Record<string, never>>('ranger.initialized', [
  TRAIT.FORTIFYING_BOND,
  TRAIT.NATURAL_MENDER
]);
