import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Mark an airborne autoattack when an owned strike landed during the interval identified by shared normalization. */
export function markVindicatorDodgeAutos(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return context.recordedActions.map((action) => {
    if (!action.concurrentTimeline) return action;

    const landed = context.evidence.eventsBySkill
      .get(action.rawSkillId)
      ?.some(
        ({ event }) =>
          event.source === context.playerAddress &&
          event.stateChange === 0 &&
          event.buff === 0 &&
          event.value > 0 &&
          event.time >= action.start &&
          event.time <= action.end
      );
    return landed ? { ...action, vindicatorDodgeAuto: true } : action;
  });
}
