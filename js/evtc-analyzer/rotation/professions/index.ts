import { reconstructElementalistProfessionActions } from './elementalist.js';
import { reconstructGuardianProfessionActions } from './guardian.js';
import { reconstructEngineerProfessionActions } from './engineer.js';
import { reconstructMesmerProfessionActions } from './mesmer.js';
import { reconstructNecromancerProfessionActions } from './necromancer.js';
import { reconstructRangerProfessionActions } from './ranger.js';
import { reconstructRevenantProfessionActions } from './revenant.js';
import { reconstructThiefProfessionActions } from './thief.js';
import { reconstructWarriorProfessionActions } from './warrior.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from './types.js';

const reconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> = new Map([
  ['elementalist', reconstructElementalistProfessionActions],
  ['engineer', reconstructEngineerProfessionActions],
  ['guardian', reconstructGuardianProfessionActions],
  ['mesmer', reconstructMesmerProfessionActions],
  ['necromancer', reconstructNecromancerProfessionActions],
  ['ranger', reconstructRangerProfessionActions],
  ['revenant', reconstructRevenantProfessionActions],
  ['thief', reconstructThiefProfessionActions],
  ['warrior', reconstructWarriorProfessionActions]
]);

export function reconstructProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return reconstructors.get(context.profile.professionId)?.(context) || context.recordedActions;
}

export type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from './types.js';
