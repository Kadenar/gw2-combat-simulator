import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** A Daredevil cast boundary. */
export interface DaredevilCast {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** Staff Master refunds endurance at acceptance, before the selected dodge queues its packets. */
export const daredevilCastStarted = defineTriggerPoint<DaredevilCast>('thief.daredevil-cast-started', [
  TRAIT.STAFF_MASTER
]);

/** After the dodge's own packets, its selected damage window precedes Weakening Strikes' next-hit reward. */
export const daredevilDodged = defineTriggerPoint<DaredevilCast>('thief.daredevil-dodged', [
  TRAIT.BOUNDING_DODGER,
  TRAIT.LOTUS_TRAINING,
  TRAIT.WEAKENING_STRIKES
]);

/** Endurance Thief follows Core's steal resources at the deferred completion owner. */
export const daredevilCastCompleted = defineTriggerPoint<DaredevilCast>('thief.daredevil-cast-completed', [
  TRAIT.ENDURANCE_THIEF
]);

/** A landed strike while Daredevil is selected. */
export interface DaredevilStrike {
  readonly cause: Gw2ResolverEvent;
}

/** The next landed player strike consumes an armed Weakening Strikes grant. */
export const daredevilStruck = defineTriggerPoint<DaredevilStrike>('thief.daredevil-strike', [TRAIT.WEAKENING_STRIKES]);

/** An accepted physical skill. */
export interface PhysicalSkillStart {
  readonly context: ActionContext;
}

/** Brawler's Tenacity grants endurance when an eligible physical skill is accepted. */
export const physicalSkillStarted = defineTriggerPoint<PhysicalSkillStart>('thief.physical-skill-started', [
  TRAIT.BRAWLERS_TENACITY
]);
