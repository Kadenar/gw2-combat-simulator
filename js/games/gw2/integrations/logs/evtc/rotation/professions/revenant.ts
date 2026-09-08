import { reconstructCommonRevenantActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/common.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { reconstructConduitActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/conduit.js';
import { reconstructHeraldActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/herald.js';
import { normalizeRevenantCastPackets } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/normalization.js';
import { reconstructRenegadeActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/renegade.js';
import { reconstructVindicatorActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/vindicator.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

const specializationReconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> = new Map([
  ['conduit', reconstructConduitActions],
  ['herald', reconstructHeraldActions],
  ['renegade', reconstructRenegadeActions],
  ['vindicator', reconstructVindicatorActions]
]);

export function reconstructRevenantProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = (
    specializationReconstructors.get(context.profile.specializationId) || reconstructCommonRevenantActions
  )(context);
  // Arc records recovery animations after target death; retain in-flight casts but omit later player inputs.
  const encounterEnd = encounterEndTime(context.log);
  return normalizeRevenantCastPackets(
    context,
    actions.filter((action) => encounterEnd == null || action.start < encounterEnd)
  );
}
