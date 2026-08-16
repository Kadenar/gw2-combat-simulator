import {
  addRangerCommonActions,
  normalizeRangerCommonActions,
} from "./ranger/common.js";
import { reconstructDruidActions } from "./ranger/druid.js";
import { reconstructGaleshotActions } from "./ranger/galeshot.js";
import { reconstructRangerPetActions } from "./ranger/pets.js";
import { finalizeRangerActions } from "./ranger/shared.js";
import { reconstructSoulbeastActions } from "./ranger/soulbeast.js";
import { reconstructUntamedActions } from "./ranger/untamed.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

type RangerActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<string, RangerActionTransform> =
  new Map([
    ["druid", reconstructDruidActions],
    ["galeshot", reconstructGaleshotActions],
    ["soulbeast", reconstructSoulbeastActions],
    ["untamed", reconstructUntamedActions],
  ]);

export function reconstructRangerProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const analyzer = specializationAnalyzers.get(
    context.profile.specializationId,
  );
  let actions = [
    ...context.recordedActions,
    ...reconstructRangerPetActions(context),
  ];
  actions = normalizeRangerCommonActions(context, actions);
  actions = analyzer?.(context, actions) || actions;
  actions = addRangerCommonActions(context, actions);
  return finalizeRangerActions(context, actions);
}
