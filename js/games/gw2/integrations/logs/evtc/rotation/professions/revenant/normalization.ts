import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { SIGNAL_DEDUPLICATION_WINDOW_MS } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/shared.js';
import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';

const REDUCED_CAST_TOLERANCE_MS = 50;

const SPLIT_ANIMATION_PAIRS = [
  { startId: 27074, finishId: 28625, maximumGapMs: SIGNAL_DEDUPLICATION_WINDOW_MS },
  { startId: 28029, finishId: 26923, maximumGapMs: SIGNAL_DEDUPLICATION_WINDOW_MS },
  { startId: 62895, finishId: 62713, maximumGapMs: SIGNAL_DEDUPLICATION_WINDOW_MS }
] as const;

function mergeSplitAnimations(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  return mergeCompositeActions(actions, SPLIT_ANIMATION_PAIRS, (action, second) => ({
    ...action,
    end: Math.max(action.end, second.end),
    status: mergedActionStatus(action.status, second.status)
  }));
}

function cancelFireAtActionEnd(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === action.rawSkillId &&
      (event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP) &&
      event.activation === EVTC_ACTIVATION.CANCEL_FIRE &&
      Math.abs(event.time - action.end) <= SIGNAL_DEDUPLICATION_WINDOW_MS
  );
}

export function normalizeRevenantCastPackets(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized: EvtcRecordedRotationAction[] = [];

  for (const action of mergeSplitAnimations(actions)) {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile
    );
    const duration = Math.max(0, action.end - action.start);
    const expected = Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
    const autoattack = String(skill?.slot || '').toLowerCase() === 'weapon_1';
    // A same-frame cancelled autoattack never occupied the cast lane; omit the ArcDPS animation artifact.
    if (autoattack && action.status === 'interrupted' && duration === 0) continue;
    if (
      action.status === 'completed' &&
      duration > 0 &&
      expected > 0 &&
      duration + REDUCED_CAST_TOLERANCE_MS < expected &&
      cancelFireAtActionEnd(context, action)
    ) {
      // Preserve shortened player inputs and let shared replay timing round their observed duration.
      normalized.push({
        ...action,
        status: autoattack ? ('interrupted' as const) : ('reduced' as const),
        replayCastEnd: undefined
      });
      continue;
    }

    normalized.push(action);
  }

  return normalized;
}
