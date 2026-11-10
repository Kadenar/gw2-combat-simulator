import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';

/** Only earned Swift Scholar refunds trigger these trait rewards. */
export const swiftScholarPagesGranted = defineTriggerPoint<{ readonly cast: RuntimeCast<GuardianSkill> }>(
  'guardian.swift-scholar-pages-granted',
  [TRAIT.FERVID_CONVICTION, TRAIT.STALWART_SPEED]
);

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

/** An accepted control, or an Immobilized application. */
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

/** Revelation adds its refund before final-charge retirement. */
export const finalMantraChargeUsed = defineTriggerPoint<FinalMantraCharge>('guardian.final-mantra-charge-used', [
  TRAIT.REVELATION
]);
