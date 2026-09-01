import { removeUncommittedMesmerAutoattacks } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/autoattacks.js';
import { reconstructChronomancerActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/chronomancer.js';
import { addMesmerCommonActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/common.js';
import { reconstructMirageActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/mirage.js';
import { dedupeActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/shared.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { reconstructVirtuosoActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/virtuoso.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

type MesmerActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const MIRAGE_ENCOUNTER_END_INPUT_GRACE_MS = 2000;

const specializationReconstructors: ReadonlyMap<string, MesmerActionTransform> = new Map([
  ['chronomancer', reconstructChronomancerActions],
  ['mirage', reconstructMirageActions],
  ['virtuoso', reconstructVirtuosoActions]
]);

/**
 * Removes actions beyond the encounter boundary, applies Mirage's post-encounter input grace period, and deduplicates
 * the merged generic and specialization-specific action streams.
 */
function finalizeMesmerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context.log);
  const encounterEndGrace = context.profile.specializationId === 'mirage' ? MIRAGE_ENCOUNTER_END_INPUT_GRACE_MS : 0;
  return dedupeActions(
    actions.filter((action) => encounterEnd == null || action.start < encounterEnd + encounterEndGrace)
  );
}

/**
 * Runs the Mesmer EVTC reconstruction pipeline: common evidence recovery, specialization mechanics, autoattack
 * commitment filtering, encounter-boundary cleanup, and final deduplication.
 */
export function reconstructMesmerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  let actions = addMesmerCommonActions(context, context.recordedActions);
  actions = specializationReconstructors.get(context.profile.specializationId)?.(context, actions) || actions;
  actions = removeUncommittedMesmerAutoattacks(context, actions);
  return finalizeMesmerActions(context, actions);
}
