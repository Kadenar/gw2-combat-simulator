import { reconstructEngineerDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/engineer.js';
import { reconstructElementalistDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/elementalist.js';
import { reconstructGuardianDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/guardian.js';
import { reconstructMesmerDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/mesmer.js';
import { reconstructNecromancerDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/necromancer.js';
import { reconstructRangerDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/ranger.js';
import { reconstructRevenantDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/revenant.js';
import { reconstructThiefDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/thief.js';
import { reconstructWarriorDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/warrior.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const reconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['elementalist', reconstructElementalistDpsReportActions],
  ['engineer', reconstructEngineerDpsReportActions],
  ['guardian', reconstructGuardianDpsReportActions],
  ['mesmer', reconstructMesmerDpsReportActions],
  ['necromancer', reconstructNecromancerDpsReportActions],
  ['ranger', reconstructRangerDpsReportActions],
  ['revenant', reconstructRevenantDpsReportActions],
  ['thief', reconstructThiefDpsReportActions],
  ['warrior', reconstructWarriorDpsReportActions]
]);

/** Dispatches report-only corrections without coupling the generic timeline to one profession. */
export function reconstructDpsReportProfessionActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const reconstruct = reconstructors.get(context.profile.professionId);
  return reconstruct ? reconstruct(context) : [...context.recordedActions];
}
