import type { EvtcReconstructionEvidence } from '#gw2/integrations/logs/evtc/rotation/evidence.js';
import { weaverAttunementEvents } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist/weaver-attunements.js';
import { engineerKitActions } from '#gw2/integrations/logs/evtc/rotation/professions/engineer/kit-actions.js';
import { mirageCloakActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/mirage-cloak.js';
import { selectRangerPetCommands } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/pet-commands.js';
import { rangerRepresentedActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/represented-actions.js';
import { markVindicatorDodgeAutos } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/vindicator.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { warriorSignetActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/signet-of-might.js';
import { normalizeLogProfessionActions } from '#gw2/integrations/logs/shared/rotation/professions/index.js';

/** Select the event index used by instant finders while preserving raw evidence for subsequent reconstruction. */
export function professionInstantCastEvents(
  context: EvtcProfessionReconstructionContext
): EvtcReconstructionEvidence['eventsBySkill'] {
  return context.profile.specializationId === 'weaver'
    ? weaverAttunementEvents(context)
    : context.evidence.eventsBySkill;
}

/** Choose the profession's source evidence before shared normalization consumes the recorded actions. */
export function selectProfessionSourceActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return context.profile.professionId === 'ranger' ? selectRangerPetCommands(context) : context.recordedActions;
}

/** Resolve identities supported by EVTC evidence before shared rules combine or discard actions. */
function representedProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  switch (context.profile.professionId) {
    case 'engineer':
      return engineerKitActions(context);
    case 'mesmer':
      return context.profile.specializationId === 'mirage' ? mirageCloakActions(context) : context.recordedActions;
    case 'ranger':
      return rangerRepresentedActions(context);
    case 'warrior':
      return warriorSignetActions(context);
    default:
      return context.recordedActions;
  }
}

/** Preserve EVTC evidence and event ordering through shared normalization, including actions with no source row. */
export function reconstructProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const originals = representedProfessionActions(context);
  const recordedActions = originals.map((action, index) => ({
    ...action,
    eventIndex: index,
    sourceActionIndex: index,
    rawName: action.rawName === 'Swap Weapons' ? 'Weapon Swap' : action.rawName,
    isSwap: action.isSwap ?? action.weaponSet != null,
    metadataAccurate: action.metadataAccurate ?? true
  }));
  const normalized = normalizeLogProfessionActions({ ...context, recordedActions });
  const actions = normalized.map((action): EvtcRecordedRotationAction => {
    const source = action.sourceActionIndex == null ? undefined : originals[action.sourceActionIndex];
    return {
      ...source,
      ...action,
      evidence: source?.evidence ?? 'synthesized',
      eventIndex: source?.eventIndex ?? action.eventIndex,
      rawName: action.rawName === 'Weapon Swap' ? 'Swap Weapons' : action.rawName
    };
  });
  return context.profile.specializationId === 'vindicator'
    ? markVindicatorDodgeAutos({ ...context, recordedActions: actions })
    : actions;
}
