import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';

/** An opened tome; `ready` reports whether its dormancy allowed a fresh virtue activation. */
export interface TomeOpening {
  readonly cast: RuntimeCast<GuardianSkill>;
  readonly virtue: GuardianVirtue;
  readonly ready: boolean;
}

/** A new tome session restarts Swift Scholar's page count; a ready opening also grants its boon after virtue rewards. */
export const tomeOpened = defineTriggerPoint<TomeOpening>('guardian.tome-opened', [TRAIT.SWIFT_SCHOLAR]);

/** Stowing ends the page session without revoking refunds earned by accepted pages. */
export const tomeStowed = defineTriggerPoint<Record<string, never>>('guardian.tome-stowed', [TRAIT.SWIFT_SCHOLAR]);

/** An accepted player hit that dealt damage, after Ashes consumption. */
export interface FirebrandStrike {
  readonly cause: Gw2ResolverEvent;
}

/** Axe Bleeding follows Ashes consumption on the same accepted hit. */
export const firebrandStruck = defineTriggerPoint<FirebrandStrike>('guardian.firebrand-strike', [
  TRAIT.UNRELENTING_CRITICISM
]);

/** A delivered buff or boon, after Alacrity has queued the mantra wake. */
export interface FirebrandBuffApplication {
  readonly cause: Gw2ResolverEvent;
}

/** Stalwart Speed's shared Quickness settles before Quickfire inspects delivered Quickness. */
export const firebrandBuffApplied = defineTriggerPoint<FirebrandBuffApplication>('guardian.firebrand-buff-applied', [
  TRAIT.STALWART_SPEED,
  TRAIT.QUICKFIRE
]);

/** An accepted control, or an Immobilized or Slow application. */
export interface FirebrandControl {
  readonly cause: Gw2ResolverEvent;
}

/** Both control paths reach Stoic Demeanor at their own resolution boundary. */
export const firebrandControlAccepted = defineTriggerPoint<FirebrandControl>('guardian.firebrand-control-accepted', [
  TRAIT.STOIC_DEMEANOR
]);

/** A final mantra charge, before the mechanic retires its charges and starts recharge. */
export interface FinalMantraCharge {
  readonly context: ActionContext;
}

/** Weighty Terms rewards precede final-charge retirement. */
export const finalMantraChargeUsed = defineTriggerPoint<FinalMantraCharge>('guardian.final-mantra-charge-used', [
  TRAIT.WEIGHTY_TERMS
]);
