import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Parent recharge starts before the consumed facet can retain its passive. */
export const facetConsumed = defineTriggerPoint<{
  readonly facet: RevenantSkill;
  readonly wasActive: boolean;
}>('revenant.facet-consumed', [TRAIT.DRACONIC_ECHO]);

/** Completed or cancelled casts expose their final upkeep before the cadence synchronizes. */
export const heraldUpkeepSettled = defineTriggerPoint<Record<string, never>>('revenant.herald-upkeep-settled', [
  TRAIT.ELEVATED_COMPASSION
]);
