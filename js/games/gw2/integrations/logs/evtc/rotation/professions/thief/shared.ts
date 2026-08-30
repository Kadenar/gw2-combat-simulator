import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export const SIGNAL_WINDOW_MS = 150;
export const ASSASSINS_SIGNET = Object.freeze({
  name: "Assassin's Signet",
  skillId: 13046
});
export const ASSASSINS_SIGNET_ACTIVE_BUFF = 44597;

export interface ThiefActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export function playerEvent(
  context: EvtcProfessionReconstructionContext,
  event: EvtcProfessionReconstructionContext['log']['events'][number]
): boolean {
  return event.source === context.playerAddress || event.target === context.playerAddress;
}

export function combatStart(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find(
      (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
    )?.time ?? null
  );
}

export function skillDuration(context: EvtcProfessionReconstructionContext, identity: ThiefActionIdentity): number {
  const skill = findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

export function canonicalAction(
  eventIndex: number,
  start: number,
  identity: ThiefActionIdentity,
  rawSkillId: number,
  evidence: EvtcRecordedRotationAction['evidence'] = 'buff-transition'
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: 'instant',
    eventIndex
  };
}

export function hasRecordedAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: ThiefActionIdentity,
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

export function hasSelectedSkill(context: EvtcProfessionReconstructionContext, identity: ThiefActionIdentity): boolean {
  return (
    context.selectedSkillNames == null ||
    context.selectedSkillNames.some((name) => name.trim().toLowerCase() === identity.name.toLowerCase())
  );
}
