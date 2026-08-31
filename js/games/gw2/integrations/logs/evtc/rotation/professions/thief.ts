import { normalizeThiefAnimations } from '#gw2/integrations/logs/evtc/rotation/professions/thief/animations.js';
import { reconstructAntiquaryActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief/antiquary.js';
import { reconstructThiefCommonActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief/common.js';
import { reconstructDaredevilActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief/daredevil.js';
import { reconstructDeadeyeActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief/deadeye.js';
import { reconstructSpecterActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief/specter.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

type ThiefActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationReconstructors: ReadonlyMap<string, ThiefActionTransform> = new Map([
  ['antiquary', reconstructAntiquaryActions],
  ['daredevil', reconstructDaredevilActions],
  ['deadeye', reconstructDeadeyeActions],
  ['specter', reconstructSpecterActions]
]);

export function reconstructThiefProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  let actions = normalizeThiefAnimations(context);
  actions = reconstructThiefCommonActions(context, actions);
  return specializationReconstructors.get(context.profile.specializationId)?.(context, actions) || actions;
}
