import type {
  LogActionNormalizationContext,
  LogActionNormalizer,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { reconstructElementalistDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/elementalist.js';
import { reconstructEngineerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer.js';
import { reconstructGuardianDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/guardian.js';
import { reconstructMesmerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/mesmer.js';
import { reconstructNecromancerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/necromancer.js';
import { reconstructRangerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/ranger.js';
import { reconstructRevenantDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/revenant.js';
import { reconstructThiefDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/thief.js';
import { reconstructWarriorDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';

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
  // Profession normalizers receive the recorded inputs directly; unsupported combat modes have no separate filter.
  return reconstruct ? reconstruct(context) : context.recordedActions;
}
