import { removeUncommittedMesmerAutoattacks } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/autoattacks.js';
import { reconstructChronomancerActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/chronomancer.js';
import { addMesmerCommonActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/common.js';
import { reconstructMirageActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/mirage.js';
import { dedupeActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/shared.js';
import { reconstructVirtuosoActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/virtuoso.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

type MesmerActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationReconstructors: ReadonlyMap<string, MesmerActionTransform> = new Map([
  ['chronomancer', reconstructChronomancerActions],
  ['mirage', reconstructMirageActions],
  ['virtuoso', reconstructVirtuosoActions]
]);

/**
 * Runs the Mesmer EVTC reconstruction pipeline: common evidence recovery, specialization mechanics, autoattack
 * commitment filtering, and final deduplication.
 */
export function reconstructMesmerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  let actions = addMesmerCommonActions(context, context.recordedActions);
  actions = specializationReconstructors.get(context.profile.specializationId)?.(context, actions) || actions;
  actions = removeUncommittedMesmerAutoattacks(context, actions);
  return dedupeActions(actions);
}
