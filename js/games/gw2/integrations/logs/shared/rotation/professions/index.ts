import { reconstructEngineerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer.js';
import { reconstructElementalistDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/elementalist.js';
import { reconstructGuardianDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/guardian.js';
import { reconstructMesmerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/mesmer.js';
import { reconstructNecromancerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/necromancer.js';
import { reconstructRangerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/ranger.js';
import { reconstructRevenantDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/revenant.js';
import { reconstructThiefDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/thief.js';
import { reconstructWarriorDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const reconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
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

/** Dispatches shared normalization of represented inputs without coupling the timeline to one profession. */
export function normalizeLogProfessionActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const reconstruct = reconstructors.get(context.profile.professionId);
  return reconstruct ? reconstruct(context) : [...context.recordedActions];
}
