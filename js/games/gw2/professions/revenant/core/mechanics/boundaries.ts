import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export interface RevenantStrike {
  readonly cause: Gw2ResolverEvent;
}
/** Catch up Thrill of Combat before the same landed strike consumes a Battle Scar. */
export const revenantStruck = defineTriggerPoint<RevenantStrike>('revenant.strike', [TRAIT.THRILL_OF_COMBAT]);
/** After scar consumption, Might precedes the opening Vulnerability and the mechanic's Enchanted Daggers. */
export const battleScarConsumed = defineTriggerPoint<RevenantStrike>('revenant.battle-scar-consumed', [
  TRAIT.VICIOUS_REPRISAL,
  TRAIT.EXPOSE_DEFENSES
]);

export interface RevenantCastCompletion {
  readonly cast: RuntimeCast<RevenantSkill>;
}
/** A single mechanic claim admits accepted completion rewards across Core and elite delivery paths. */
export const revenantCastCompleted = defineTriggerPoint<RevenantCastCompletion>('revenant.cast-completed', [
  TRAIT.BATTLE_SCARRED,
  TRAIT.NOTORIETY,
  TRAIT.SERENE_REJUVENATION
]);
/** Accepted legend swaps grant their ordered rewards only after energy, flips, upkeep, and sigil effects settle. */
export const legendInvoked = defineTriggerPoint<{ readonly at: number }>('revenant.legend-invoked', [
  TRAIT.INVOKERS_RAGE,
  TRAIT.SPIRIT_BOON,
  TRAIT.SONG_OF_THE_MISTS,
  TRAIT.INVOKING_TORMENT
]);
/** Chilled and Vulnerability reactions retain their order after an accepted condition application. */
export const revenantConditionApplied = defineTriggerPoint<RevenantStrike>('revenant.condition-applied', [
  TRAIT.ABYSSAL_CHILL,
  TRAIT.DANCE_OF_DEATH
]);
/** Weapon-swap rewards run after the accepted swap and before ordinary completion listeners. */
export const revenantWeaponSwapped = defineTriggerPoint<RevenantCastCompletion>('revenant.weapon-swapped', [
  TRAIT.BRUTALITY
]);

/** Initialization and explicit combat entry anchor the trait's independently owned pulse lifetime. */
export const revenantLifecycleAnchored = defineTriggerPoint<{ readonly at: number }>('revenant.lifecycle-anchored', [
  TRAIT.ASSASSINS_PRESENCE
]);

/** Elite invocation rewards retain their later observer position after Core invocation packets. */
export const eliteLegendInvoked = defineTriggerPoint<{ readonly at: number }>('revenant.elite-legend-invoked', [
  TRAIT.SONG_OF_THE_MISTS
]);

/** Song grants the accepted invocation's Fervor through the specialization's intrinsic stack delivery. */
export const invocationFervorGranted = defineTriggerPoint<{
  readonly sourceId: SkillId;
  readonly sourceName: string;
  readonly at: number;
}>('revenant.invocation-fervor-granted', [TRAIT.AMBUSH_COMMANDER]);
