import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { CONTINUUM_SHIFT_GAME_ID } from '#gw2/integrations/logs/shared/rotation/professions/mesmer.js';

/**
 * EI records Shift for every Split ending. Only an early removal, which leaves Split duration remaining, is a player
 * input. The simulator schedules natural expiry itself, so replaying that Shift would duplicate it.
 */
export function chronomancerShiftActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return context.recordedActions.filter(
    (action) =>
      action.rawSkillId !== CONTINUUM_SHIFT_GAME_ID ||
      action.evidence !== 'buff-transition' ||
      context.log.events[action.eventIndex].value > 0
  );
}
