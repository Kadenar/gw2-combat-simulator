import type { DpsReportPlayer, DpsReportRotationGroup } from '#gw2/integrations/logs/dps-report/types.js';
import type { RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { rangerRecordedPetCommand } from '#gw2/professions/ranger/data/pet-commands.js';

/**
 * Owned pet casts replace player markers for the same skill. EI delays F2 markers, so replaying them would let
 * autonomous pet attacks run too long. Soulbeast records merged skills on the player.
 */
export function rangerSourceGroups(
  player: DpsReportPlayer,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null
): readonly DpsReportRotationGroup[] {
  if (profile.specializationId === 'soulbeast' || !catalog) return player.rotation;

  const petGroups = (player.minions ?? []).flatMap((minion) =>
    (minion.rotation ?? []).filter(
      (group) =>
        group.skills.length > 0 &&
        rangerRecordedPetCommand(catalog.skillsById.get(group.id), profile.specializationName)
    )
  );
  const petSkillIds = new Set(petGroups.map((group) => group.id));
  return [...player.rotation.filter((group) => !petSkillIds.has(group.id)), ...petGroups];
}
