import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

/** A positive strike by the Mechanist mech, with the resolved critical outcome. */
export interface MechStrike {
  readonly cause: EngineerResolverEvent;
  readonly details: NativeResolvedDamageDetails;
}

/**
 * Mechanist fires this Core point for each positive mech strike, so Core Firearms traits keep mech-owned proc trackers
 * that the player's critical hits cannot consume. Their critical procs precede the Mechanist arm rewards.
 */
export const mechStruck = defineTriggerPoint<MechStrike>('engineer.mech-struck', [
  TRAIT.SERRATED_STEEL,
  TRAIT.INCENDIARY_POWDER,
  TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
  TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
  TRAIT.MECH_ARMS_JADE_CANNONS
]);
