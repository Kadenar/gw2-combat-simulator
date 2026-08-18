import { EVTC_STATE_CHANGE } from '../../../types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../../professions/elementalist/data/ids.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

const EVOKER_SKILL_ALIASES = new Map([
  [76925, { name: 'Calcify', skillId: ID.CALCIFY }],
  [76707, { name: 'Seismic Impact', skillId: ID.SEISMIC_IMPACT }],
  [77247, { name: "Toad's Fortitude", skillId: ID.TOADS_FORTITUDE }]
]);
const CALCIFY_RAW_SKILL_ID = 76925;
const CALCIFY = Object.freeze({ name: 'Calcify', skillId: ID.CALCIFY });

function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

function calcifyActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const starts = context.log.events.filter(
    (event) =>
      event.sourceMasterInstance === ownerInstance &&
      event.skillId === CALCIFY_RAW_SKILL_ID &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
  );

  return context.log.events.flatMap((event, eventIndex) => {
    if (event.sourceMasterInstance !== ownerInstance || event.skillId !== CALCIFY_RAW_SKILL_ID) {
      return [];
    }
    const directStart = event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START;
    const unmatchedStop =
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.value > 0 &&
      !starts.some(
        (start) =>
          start.source === event.source &&
          start.time < event.time &&
          Math.abs(event.time - start.time - event.value) <= 150
      );
    if (!directStart && !unmatchedStop) return [];
    const start = directStart ? event.time : event.time - event.value;
    return [
      {
        start,
        end: start,
        expectedDuration: 0,
        rawSkillId: event.skillId,
        rawName: CALCIFY.name,
        canonicalSkillId: CALCIFY.skillId,
        canonicalName: CALCIFY.name,
        evidence: 'animation' as const,
        status: 'instant' as const,
        eventIndex,
        ...(unmatchedStop ? { precast: true } : {})
      }
    ];
  });
}

/** Normalizes Evoker-only ArcDPS skill IDs into simulator skill identities. */
export function reconstructEvokerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = actions.map((action) => {
    const identity = EVOKER_SKILL_ALIASES.get(action.rawSkillId);
    if (!identity) return action;
    return {
      ...action,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name
    };
  });
  return [...normalized, ...calcifyActions(context)].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
