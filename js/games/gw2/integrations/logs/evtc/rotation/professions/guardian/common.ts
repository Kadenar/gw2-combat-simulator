import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import { committedActionsFromStrikePackets } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  canonicalAction,
  recordedDuration,
  SIGNAL_WINDOW_MS
} from '#gw2/integrations/logs/evtc/rotation/professions/guardian/shared.js';

const ZEALOTS_FLAME = Object.freeze({
  name: "Zealot's Flame",
  skillId: 9104
});
const ZEALOTS_FLAME_BUFF = 9103;

function removeDuplicateZeroDurationInterrupts(
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.filter(
    (action) =>
      !(
        action.status === 'interrupted' &&
        action.end === action.start &&
        actions.some(
          (candidate) =>
            candidate !== action &&
            candidate.status === 'completed' &&
            candidate.rawSkillId === action.rawSkillId &&
            candidate.start >= action.start &&
            candidate.start - action.start <= SIGNAL_WINDOW_MS
        )
      )
  );
}

function recoverCompletedZeroDurationCasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const candidates = actions.filter((action) => action.status === 'interrupted' && action.end === action.start);
  const committed = committedActionsFromStrikePackets(context, candidates, {
    maxFallbackImpactMs: 6_000
  });
  return actions.map((action) => {
    if (action.status !== 'interrupted' || action.end !== action.start) {
      return action;
    }

    if (!committed.has(action)) return action;
    const duration = recordedDuration(context, {
      name: action.rawName,
      skillId: action.rawSkillId
    });
    return {
      ...action,
      end: action.start + duration,
      expectedDuration: duration,
      status: 'completed'
    };
  });
}

function inferZealotsFlame(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== ZEALOTS_FLAME_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      actions.some(
        (action) =>
          (action.rawSkillId === ZEALOTS_FLAME.skillId || action.canonicalSkillId === ZEALOTS_FLAME.skillId) &&
          Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS
      )
    ) {
      return;
    }

    inferred.push(canonicalAction(eventIndex, event.time, ZEALOTS_FLAME, event.skillId));
  });
  return inferred;
}

function removePostEncounterActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context.log);
  return encounterEnd == null ? [...actions] : actions.filter((action) => action.start < encounterEnd);
}

function alignReplayCastLanes(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (action.status !== 'completed') return action;
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile
    );
    const runtimeDuration = Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
    const replayCastEnd = Math.max(action.end, action.start + runtimeDuration);
    return replayCastEnd > action.end ? { ...action, replayCastEnd } : action;
  });
}

export function prepareGuardianActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return recoverCompletedZeroDurationCasts(context, removeDuplicateZeroDurationInterrupts(actions));
}

export function addGuardianCommonActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return [...actions, ...inferZealotsFlame(context, actions)];
}

export function finalizeGuardianActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return alignReplayCastLanes(context, removePostEncounterActions(context, actions));
}
