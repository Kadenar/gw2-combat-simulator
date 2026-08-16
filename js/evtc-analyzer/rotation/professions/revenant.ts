import { reconstructCommonRevenantActions } from "./revenant/common.js";
import { reconstructHeraldActions } from "./revenant/herald.js";
import { normalizeRevenantCastPackets } from "./revenant/normalization.js";
import { reconstructRenegadeActions } from "./revenant/renegade.js";
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

const specializationReconstructors: ReadonlyMap<
  string,
  EvtcProfessionActionReconstructor
> = new Map([
  ["herald", reconstructHeraldActions],
  ["renegade", reconstructRenegadeActions],
]);

export function reconstructRevenantProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const actions = (
    specializationReconstructors.get(context.profile.specializationId) ||
    reconstructCommonRevenantActions
  )(context);
  return normalizeRevenantCastPackets(context, actions);
}
