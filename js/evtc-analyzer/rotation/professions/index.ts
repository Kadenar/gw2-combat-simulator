import { reconstructGuardianProfessionActions } from "./guardian.js";
import { reconstructNecromancerProfessionActions } from "./necromancer.js";
import { reconstructRangerProfessionActions } from "./ranger.js";
import { reconstructRevenantProfessionActions } from "./revenant.js";
import { reconstructThiefProfessionActions } from "./thief.js";
import { reconstructWarriorProfessionActions } from "./warrior.js";
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

const reconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> =
  new Map([
    ["guardian", reconstructGuardianProfessionActions],
    ["necromancer", reconstructNecromancerProfessionActions],
    ["ranger", reconstructRangerProfessionActions],
    ["revenant", reconstructRevenantProfessionActions],
    ["thief", reconstructThiefProfessionActions],
    ["warrior", reconstructWarriorProfessionActions],
  ]);

export function reconstructProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  return (
    reconstructors.get(context.profile.professionId)?.(context) ||
    context.recordedActions
  );
}

export type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";
