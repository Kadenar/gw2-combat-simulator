import type {
  LogActionNormalizationContext,
  LogActionNormalizer,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { normalizeElementalistLogActions } from '#gw2/integrations/logs/shared/rotation/professions/elementalist.js';
import { normalizeEngineerLogActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer.js';
import { normalizeGuardianLogActions } from '#gw2/integrations/logs/shared/rotation/professions/guardian.js';
import { normalizeMesmerLogActions } from '#gw2/integrations/logs/shared/rotation/professions/mesmer.js';
import { normalizeNecromancerLogActions } from '#gw2/integrations/logs/shared/rotation/professions/necromancer.js';
import { normalizeRangerLogActions } from '#gw2/integrations/logs/shared/rotation/professions/ranger.js';
import { normalizeRevenantLogActions } from '#gw2/integrations/logs/shared/rotation/professions/revenant.js';
import { normalizeThiefLogActions } from '#gw2/integrations/logs/shared/rotation/professions/thief.js';
import { normalizeWarriorLogActions } from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';

const normalizers: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['elementalist', normalizeElementalistLogActions],
  ['engineer', normalizeEngineerLogActions],
  ['guardian', normalizeGuardianLogActions],
  ['mesmer', normalizeMesmerLogActions],
  ['necromancer', normalizeNecromancerLogActions],
  ['ranger', normalizeRangerLogActions],
  ['revenant', normalizeRevenantLogActions],
  ['thief', normalizeThiefLogActions],
  ['warrior', normalizeWarriorLogActions]
]);

/** Dispatches shared normalization of represented inputs without coupling the timeline to one profession. */
export function normalizeLogProfessionActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const normalize = normalizers.get(context.profile.professionId);
  // Profession normalizers receive the recorded inputs directly; unsupported combat modes have no separate filter.
  return normalize ? normalize(context) : context.recordedActions;
}
