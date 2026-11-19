import { galeshotCycloneBowActions } from '#gw2/integrations/logs/evtc/rotation/professions/galeshot.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

/** Resolve Cyclone Bow transitions before using the spacing of owned hits to identify the Path of Scars variant. */
export function rangerRepresentedActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = galeshotCycloneBowActions(context);
  return actions.map((action, index) => {
    if (action.rawSkillId !== ID.PATH_OF_SCARS) return action;

    const next = actions.slice(index + 1).find((candidate) => candidate.rawSkillId === ID.PATH_OF_SCARS);
    const hits = (context.evidence.eventsBySkill.get(ID.PATH_OF_SCARS) ?? [])
      .map(({ event }) => event)
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.target !== context.playerAddress &&
          event.stateChange === 0 &&
          event.activation === 0 &&
          event.buff === 0 &&
          event.value > 0 &&
          event.time >= action.start &&
          event.time <= action.start + 3000 &&
          event.time < (next?.start ?? Infinity)
      )
      .sort((left, right) => left.time - right.time);

    return hits.length >= 2 && hits[1].time - hits[0].time > 900
      ? { ...action, canonicalSkillId: ID.PATH_OF_SCARS_MAX_RANGE, canonicalName: 'Path of Scars (Max Range)' }
      : action;
  });
}
