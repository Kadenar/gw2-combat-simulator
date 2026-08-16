import { normalizeNecromancerAutoattackChains } from "./necromancer/autoattacks.js";
import { reconstructReaperActions } from "./necromancer/reaper.js";
import { reconstructRitualistActions } from "./necromancer/ritualist.js";
import { reconstructScourgeActions } from "./necromancer/scourge.js";
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

const specializationReconstructors: ReadonlyMap<
  string,
  EvtcProfessionActionReconstructor
> = new Map([
  ["reaper", reconstructReaperActions],
  ["ritualist", reconstructRitualistActions],
  ["scourge", reconstructScourgeActions],
]);

export function reconstructNecromancerProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const actions =
    specializationReconstructors.get(context.profile.specializationId)?.(
      context,
    ) || context.recordedActions;
  return normalizeNecromancerAutoattackChains(context, actions);
}
