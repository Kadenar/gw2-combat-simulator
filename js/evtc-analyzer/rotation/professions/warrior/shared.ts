import type { Skill } from "../../../../platform/engine/types.js";
import { EVTC_STATE_CHANGE } from "../../../types.js";
import { findRotationSkill } from "../../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";

export interface WarriorActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export const SIGNAL_WINDOW_MS = 150;

export function combatStart(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT,
    )?.time ?? null
  );
}

export function playerInitialBuff(
  context: EvtcProfessionReconstructionContext,
  buffSkillId: number,
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === buffSkillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
  );
}

export function skillFor(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
): Skill | null {
  return findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
}

export function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
): number {
  const skill = skillFor(context, identity);
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

export function initialAction(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
  start: number,
  eventIndex: number,
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
    evidence: "initial-state",
    status: "completed",
    eventIndex,
    precast: true,
  };
}

export function sequentialInitialActions(
  context: EvtcProfessionReconstructionContext,
  identities: readonly WarriorActionIdentity[],
  end: number,
  eventIndexBase: number,
): EvtcRecordedRotationAction[] {
  let cursor = end;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    cursor -= recordedDuration(context, identity);
    reversed.push(
      initialAction(context, identity, cursor, eventIndexBase + index),
    );
  }
  return reversed.reverse();
}

export function instantAction(
  eventIndex: number,
  time: number,
  rawSkillId: number,
  rawName: string,
  canonical: WarriorActionIdentity,
  evidence: EvtcRecordedRotationAction["evidence"] = "effect",
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
    status: "instant",
    eventIndex,
  };
}

export function hasActionNear(
  actions: readonly EvtcRecordedRotationAction[],
  identity: WarriorActionIdentity,
  time: number,
  windowMs = SIGNAL_WINDOW_MS,
): boolean {
  const normalizedName = identity.name.toLowerCase();
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        action.rawName.trim().toLowerCase() === normalizedName ||
        action.canonicalName?.trim().toLowerCase() === normalizedName) &&
      Math.abs(action.start - time) <= windowMs,
  );
}

export function isBuffApplication(stateChange: number): boolean {
  return (
    stateChange === EVTC_STATE_CHANGE.NONE ||
    stateChange === EVTC_STATE_CHANGE.BUFF_APPLY
  );
}
