import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import { catalogDuration as recordedDuration } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Canonical skill identity used when raw EVTC evidence names a buff or effect instead of the player action. */
export interface WarriorActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

// Signals inside this window are treated as evidence for the same activation.
export const SIGNAL_WINDOW_MS = 150;

export {
  combatStartTime as combatStart,
  hasNearbyAction as hasActionNear,
  instantAction
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
export { recordedDuration };

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

/** Accepts both legacy untyped buff events and modern explicit BuffApply events. */
export function isBuffApplication(stateChange: number): boolean {
  return stateChange === EVTC_STATE_CHANGE.NONE || stateChange === EVTC_STATE_CHANGE.BUFF_APPLY;
}
