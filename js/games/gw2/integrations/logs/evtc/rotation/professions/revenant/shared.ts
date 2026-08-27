import type { Skill } from '../../../../../../platform/engine/types.js';
import { EVTC_STATE_CHANGE } from '../../../types.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

export interface RevenantActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export const SWAP_LEGENDS = Object.freeze({
  name: 'Swap Legends',
  skillId: -4
});

export const SIGNAL_DEDUPLICATION_WINDOW_MS = 150;

export function rawSkillName(context: EvtcProfessionReconstructionContext, skillId: number): string {
  return context.log.skills.find((skill) => skill.id === skillId)?.name || `Unknown ${skillId}`;
}

export function skillFor(context: EvtcProfessionReconstructionContext, identity: RevenantActionIdentity): Skill | null {
  return findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
}

export function runtimeDuration(
  context: EvtcProfessionReconstructionContext,
  identity: RevenantActionIdentity
): number {
  const skill = skillFor(context, identity);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

export function directAction(
  eventIndex: number,
  start: number,
  rawSkillId: number,
  rawName: string,
  identity: RevenantActionIdentity,
  evidence: EvtcRecordedRotationAction['evidence'] = 'buff-transition',
  duration = 0
): EvtcRecordedRotationAction {
  return {
    start,
    end: start + duration,
    expectedDuration: duration,
    rawSkillId,
    rawName,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: duration > 0 ? 'completed' : 'instant',
    eventIndex
  };
}

export function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

export function combatStart(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find(
      (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
    )?.time ?? null
  );
}

export function hasRecordedAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: RevenantActionIdentity,
  time: number,
  windowMs: number
): boolean {
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        action.rawName === identity.name ||
        action.canonicalName === identity.name) &&
      Math.abs(action.start - time) <= windowMs
  );
}
