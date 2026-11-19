import { applyMechanistAnimations } from '#gw2/integrations/logs/dps-report/rotation/professions/mechanist.js';
import { rangerSourceGroups } from '#gw2/integrations/logs/dps-report/rotation/professions/ranger.js';
import { applyWarriorSignetEvidence } from '#gw2/integrations/logs/dps-report/rotation/professions/warrior.js';
import type { DpsReportPlayer, DpsReportRotationGroup } from '#gw2/integrations/logs/dps-report/types.js';
import type { RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RecordedLogAction } from '#gw2/integrations/logs/shared/rotation/normalization.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';

/** Each profession chooses its cast evidence. All selected groups use the same EI decoder and phase rules. */
export function dpsReportSourceGroups(
  player: DpsReportPlayer,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null
): readonly DpsReportRotationGroup[] {
  return profile.professionId === 'ranger' ? rangerSourceGroups(player, profile, catalog) : player.rotation;
}

/** Refines decoded actions with report evidence outside the selected cast groups, such as buff timelines or minions. */
export function applyDpsReportProfessionEvidence(
  actions: RecordedLogAction[],
  player: DpsReportPlayer,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null
): RecordedLogAction[] {
  if (profile.professionId === 'warrior') return applyWarriorSignetEvidence(actions, player);

  return profile.specializationId === 'mechanist' ? applyMechanistAnimations(actions, player, catalog) : actions;
}
