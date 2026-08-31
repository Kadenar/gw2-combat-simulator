import { reconstructElementalistProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist.js';
import { reconstructGuardianProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/guardian.js';
import { reconstructEngineerProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/engineer.js';
import { reconstructMesmerProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/mesmer.js';
import { reconstructNecromancerProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer.js';
import { reconstructRangerProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger.js';
import { reconstructRevenantProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant.js';
import { reconstructThiefProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief.js';
import { reconstructWarriorProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

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

export type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
