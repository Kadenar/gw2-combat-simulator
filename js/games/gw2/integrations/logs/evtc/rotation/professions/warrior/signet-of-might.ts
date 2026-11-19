import { isBuffApply, isBuffRemoval } from '#gw2/integrations/logs/evtc/rotation/buff-events.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  SIGNET_OF_MIGHT_PASSIVE_ID,
  signetOfMightProcAt
} from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

/** The selected player's passive applications and removals identify Lesser Signet of Might in EVTC. */
export function warriorSignetActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const states = (context.evidence.eventsBySkill.get(SIGNET_OF_MIGHT_PASSIVE_ID) ?? [])
    .flatMap(({ event }): Array<readonly [number, number]> => {
      if (event.target === context.playerAddress && isBuffApply(context.log, event, true)) return [[event.time, 1]];

      // Losing one stack ends this nonstacking passive.
      if (event.source === context.playerAddress && isBuffRemoval(context.log, event)) return [[event.time, 0]];

      return [];
    })
    .sort((left, right) => left[0] - right[0]);

  if (!states.length) return context.recordedActions;

  return context.recordedActions.map((action) =>
    action.rawSkillId === ID.SIGNET_OF_MIGHT && action.status === 'instant' && signetOfMightProcAt(action.start, states)
      ? { ...action, canonicalSkillId: ID.LESSER_SIGNET_OF_MIGHT }
      : action
  );
}
