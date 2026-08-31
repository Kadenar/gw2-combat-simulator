import {
  addRangerCommonActions,
  normalizeRangerCommonActions
} from '#gw2/integrations/logs/evtc/rotation/professions/ranger/common.js';
import { reconstructDruidActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/druid.js';
import { reconstructGaleshotActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/galeshot.js';
import { reconstructRangerPetActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/pets.js';
import { finalizeRangerActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/shared.js';
import { reconstructSoulbeastActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/soulbeast.js';
import { reconstructUntamedActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/untamed.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

type RangerActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<string, RangerActionTransform> = new Map([
  ['druid', reconstructDruidActions],
  ['galeshot', reconstructGaleshotActions],
  ['soulbeast', reconstructSoulbeastActions],
  ['untamed', reconstructUntamedActions]
]);

export function reconstructRangerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const analyzer = specializationAnalyzers.get(context.profile.specializationId);
  let actions = [...context.recordedActions, ...reconstructRangerPetActions(context)];
  actions = normalizeRangerCommonActions(context, actions);
  actions = analyzer?.(context, actions) || actions;
  actions = addRangerCommonActions(context, actions);
  return finalizeRangerActions(context, actions);
}
