import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

export interface DeadeyeCast {
  readonly cast: RuntimeCast<ThiefSkill>;
}
export interface DeadeyeMalice {
  readonly cast: RuntimeCast<ThiefSkill> | null;
}

/** Accepted malice gains resolve the once-per-cycle reward before later mark rewards. */
export const maliceGained = defineTriggerPoint<DeadeyeMalice>('thief.malice-gained', [TRAIT.MALEFICENT_SEVEN]);
/** Spending malice rearms the cycle before Malicious Intent can seed its next reward. */
export const maliceSpent = defineTriggerPoint<Record<string, never>>('thief.malice-spent', [TRAIT.MALICIOUS_INTENT]);
/** Mark rewards follow stolen-skill acquisition, preserving the accepted mark's ordering. */
export const markCompleted = defineTriggerPoint<DeadeyeCast>('thief.mark-completed', [TRAIT.BE_QUICK_OR_BE_KILLED]);
/** Deferred completion grants stolen-skill boons, dodge rewards, then cantrip refreshes. */
export const deadeyeCastCompleted = defineTriggerPoint<DeadeyeCast>('thief.deadeye-cast-completed', [
  TRAIT.FIRE_FOR_EFFECT,
  TRAIT.SILENT_SCOPE,
  TRAIT.ONE_IN_THE_CHAMBER
]);
