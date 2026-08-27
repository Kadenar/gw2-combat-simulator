import type { Skill } from '../../../../../../platform/engine/types.js';
import { EVTC_STATE_CHANGE } from '../../../types.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

/** Canonical skill identity used when raw EVTC evidence names a buff or effect instead of the player action. */
export interface WarriorActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

// Signals inside this window are treated as evidence for the same activation.
export const SIGNAL_WINDOW_MS = 150;

/** Returns the player's first explicit EnterCombat event, which anchors inferred opening casts. */
export function combatStart(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find(
      (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
    )?.time ?? null
  );
}

/** Tests whether the initial-state snapshot proves that a self-applied buff was already active. */
export function playerInitialBuff(context: EvtcProfessionReconstructionContext, buffSkillId: number): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === buffSkillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  );
}

/** Resolves an inferred action through the active build's catalog and profile aliases. */
export function skillFor(context: EvtcProfessionReconstructionContext, identity: WarriorActionIdentity): Skill | null {
  return findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
}

/** Uses the replay duration for an inferred cast, preferring the Quickness-adjusted value recorded by the catalog. */
export function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity
): number {
  const skill = skillFor(context, identity);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

/** Builds a completed precast whose activation was omitted but whose resulting initial state survived in the log. */
export function initialAction(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
  start: number,
  eventIndex: number
): EvtcRecordedRotationAction {
  const duration = recordedDuration(context, identity);
  return {
    start,
    end: start + duration,
    expectedDuration: duration,
    rawSkillId: identity.skillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence: 'initial-state',
    status: 'completed',
    eventIndex,
    precast: true
  };
}

/**
 * Packs an inferred opening sequence backward from a known end time. Walking
 * backward lets every action retain catalog duration while preserving the
 * caller's intended cast order.
 */
export function sequentialInitialActions(
  context: EvtcProfessionReconstructionContext,
  identities: readonly WarriorActionIdentity[],
  end: number,
  eventIndexBase: number
): EvtcRecordedRotationAction[] {
  let cursor = end;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    cursor -= recordedDuration(context, identity);
    reversed.push(initialAction(context, identity, cursor, eventIndexBase + index));
  }

  return reversed.reverse();
}

/** Creates a zero-duration action recovered from an instantaneous EVTC side effect. */
export function instantAction(
  eventIndex: number,
  time: number,
  rawSkillId: number,
  rawName: string,
  canonical: WarriorActionIdentity,
  evidence: EvtcRecordedRotationAction['evidence'] = 'effect'
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName,
    canonicalSkillId: canonical.skillId,
    canonicalName: canonical.name,
    evidence,
    status: 'instant',
    eventIndex
  };
}

/**
 * Deduplicates inferred evidence against both raw and canonical action
 * identities because profile aliasing may have changed either ID or name.
 */
export function hasActionNear(
  actions: readonly EvtcRecordedRotationAction[],
  identity: WarriorActionIdentity,
  time: number,
  windowMs = SIGNAL_WINDOW_MS
): boolean {
  const normalizedName = identity.name.toLowerCase();
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        action.rawName.trim().toLowerCase() === normalizedName ||
        action.canonicalName?.trim().toLowerCase() === normalizedName) &&
      Math.abs(action.start - time) <= windowMs
  );
}

/** Accepts both legacy untyped buff events and modern explicit BuffApply events. */
export function isBuffApplication(stateChange: number): boolean {
  return stateChange === EVTC_STATE_CHANGE.NONE || stateChange === EVTC_STATE_CHANGE.BUFF_APPLY;
}
