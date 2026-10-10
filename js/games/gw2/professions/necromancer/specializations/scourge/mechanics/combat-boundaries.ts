import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Preserve the accepted barrier-applied boundary and its original reward order. */
export const scourgeBarrierApplied = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
}>('necromancer.barrier-applied', [TRAIT.ABRASIVE_GRIT, TRAIT.DESERT_EMPOWERMENT]);

/** Preserve the accepted shade-manifested boundary and its original reward order. */
export const scourgeShadeManifested = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
}>('necromancer.shade-manifested', [TRAIT.ABRASIVE_GRIT, TRAIT.DESERT_EMPOWERMENT]);

/** Preserve the accepted shade-committed boundary and its original reward order. */
export const scourgeShadeCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
}>('necromancer.shade-committed', [TRAIT.SADISTIC_SEARING]);

/** Preserve the accepted scourge-condition-applied boundary and its original reward order. */
export const scourgeConditionApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'necromancer.scourge-condition-applied',
  [TRAIT.DEMONIC_LORE, TRAIT.NOURISHING_ASHES]
);
