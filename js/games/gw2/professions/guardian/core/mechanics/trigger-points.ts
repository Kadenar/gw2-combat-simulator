import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

/** An accepted positive player impact, with the damage it dealt. */
export interface GuardianStrike {
  readonly cause: Gw2ResolverEvent;
  readonly damage: number;
}

/**
 * Zeal rewards sit between weapon ignition and Core passive Justice. Symbolic Avenger stacks before Zealot's Resolution
 * samples the target's health from before this hit.
 */
export const guardianStruck = defineTriggerPoint<GuardianStrike>('guardian.strike', [
  TRAIT.SYMBOLIC_AVENGER,
  TRAIT.ZEALOTS_RESOLUTION
]);

/** An applied buff or boon, after Alacrity has refreshed virtue readiness. */
export interface GuardianBuffApplication {
  readonly cause: Gw2ResolverEvent;
}

/** Righteous Instincts follows the Alacrity virtue refresh so its windows observe current readiness. */
export const guardianBuffApplied = defineTriggerPoint<GuardianBuffApplication>('guardian.buff-applied', [
  TRAIT.RIGHTEOUS_INSTINCTS
]);

/** A successful cast, after the torch lockout settles and before Core virtue completion. */
export interface GuardianCastCompletion {
  readonly cast: RuntimeCast<GuardianSkill>;
}

/** Completed heals grant Healer's Resolution before Protector's Restoration places its symbol. */
export const guardianCastCompleted = defineTriggerPoint<GuardianCastCompletion>('guardian.cast-completed', [
  TRAIT.HEALERS_RESOLUTION,
  TRAIT.PROTECTORS_RESTORATION
]);
