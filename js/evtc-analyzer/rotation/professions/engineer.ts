import { reconstructAmalgamActions } from './engineer/amalgam.js';
import { removeUncommittedEngineerAutoattacks } from './engineer/autoattacks.js';
import { reconstructHolosmithActions } from './engineer/holosmith.js';
import { inferDetonateActions, normalizeKitTransitions } from './engineer/kits.js';
import { reconstructMechanistActions } from './engineer/mechanist.js';
import { reconstructScrapperActions } from './engineer/scrapper.js';
import { finalizeEngineerActions } from './engineer/shared.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from './types.js';

const specializationReconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> = new Map([
  ['amalgam', reconstructAmalgamActions],
  ['holosmith', reconstructHolosmithActions],
  ['mechanist', reconstructMechanistActions],
  ['scrapper', reconstructScrapperActions]
]);

function reconstructCoreEngineerActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions = normalizeKitTransitions(context, context.recordedActions);
  actions.push(...inferDetonateActions(context));
  return actions;
}

export function reconstructEngineerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions =
    specializationReconstructors.get(context.profile.specializationId)?.(context) ||
    reconstructCoreEngineerActions(context);
  return finalizeEngineerActions(context, removeUncommittedEngineerAutoattacks(context, actions));
}
