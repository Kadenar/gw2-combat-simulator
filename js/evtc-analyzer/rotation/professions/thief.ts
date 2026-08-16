import { normalizeThiefAnimations } from "./thief/animations.js";
import { reconstructAntiquaryActions } from "./thief/antiquary.js";
import { reconstructThiefCommonActions } from "./thief/common.js";
import { reconstructDaredevilActions } from "./thief/daredevil.js";
import { reconstructDeadeyeActions } from "./thief/deadeye.js";
import { reconstructSpecterActions } from "./thief/specter.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

type ThiefActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
) => EvtcRecordedRotationAction[];

const specializationReconstructors: ReadonlyMap<string, ThiefActionTransform> =
  new Map([
    ["antiquary", reconstructAntiquaryActions],
    ["daredevil", reconstructDaredevilActions],
    ["deadeye", reconstructDeadeyeActions],
    ["specter", reconstructSpecterActions],
  ]);

export function reconstructThiefProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let actions = normalizeThiefAnimations(context);
  actions = reconstructThiefCommonActions(context, actions);
  return (
    specializationReconstructors.get(context.profile.specializationId)?.(
      context,
      actions,
    ) || actions
  );
}
