import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { isBuffApply } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Gaze applications identify otherwise unrecorded Marks; initial snapshots cannot establish a cast timestamp. */
export function deadeyeMarkActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'deadeye') return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.skillId !== 46333 ||
      event.target !== context.playerAddress ||
      !isBuffApply(context.log, event) ||
      context.recordedActions.some(
        (action) => action.rawSkillId === ID.DEADEYES_MARK && Math.abs(action.start - event.time) <= 50
      )
    )
      return [];
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: ID.DEADEYES_MARK,
        rawName: "Deadeye's Mark",
        evidence: 'buff-transition',
        status: 'instant',
        eventIndex,
        metadataAccurate: false,
        castOrigin: 'skill'
      }
    ];
  });
}
