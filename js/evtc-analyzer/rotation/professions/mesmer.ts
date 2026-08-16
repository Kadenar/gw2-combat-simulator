import { removeUncommittedMesmerAutoattacks } from "./mesmer/autoattacks.js";
import { reconstructChronomancerActions } from "./mesmer/chronomancer.js";
import { addMesmerCommonActions } from "./mesmer/common.js";
import { reconstructMirageActions } from "./mesmer/mirage.js";
import { dedupeActions, encounterEndTime } from "./mesmer/shared.js";
import { reconstructVirtuosoActions } from "./mesmer/virtuoso.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

type MesmerActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
) => EvtcRecordedRotationAction[];

const MIRAGE_ENCOUNTER_END_INPUT_GRACE_MS = 2000;

const specializationReconstructors: ReadonlyMap<string, MesmerActionTransform> =
  new Map([
    ["chronomancer", reconstructChronomancerActions],
    ["mirage", reconstructMirageActions],
    ["virtuoso", reconstructVirtuosoActions],
  ]);

function finalizeMesmerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  const encounterEndGrace =
    context.profile.specializationId === "mirage"
      ? MIRAGE_ENCOUNTER_END_INPUT_GRACE_MS
      : 0;
  return dedupeActions(
    actions.filter(
      (action) =>
        encounterEnd == null || action.start < encounterEnd + encounterEndGrace,
    ),
  );
}

export function reconstructMesmerProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let actions = addMesmerCommonActions(context, context.recordedActions);
  actions =
    specializationReconstructors.get(context.profile.specializationId)?.(
      context,
      actions,
    ) || actions;
  actions = removeUncommittedMesmerAutoattacks(context, actions);
  return finalizeMesmerActions(context, actions);
}
