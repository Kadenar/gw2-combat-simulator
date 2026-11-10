/** Bind recorded and saved protocol IDs to the selected slot without changing protocol kind or inferring a loadout. */
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

export function resolveSelectedAmalgamMorphId(
  catalog: Pick<CanonicalCatalog<AmalgamSkill>, 'skillsById'>,
  skillId: SkillId,
  selectedMorphIds: readonly SkillId[]
): SkillId {
  const kind = catalog.skillsById.get(skillId)?.morphKind;

  if (kind == null) return skillId;

  const candidates = selectedMorphIds.filter((id) => catalog.skillsById.get(id)?.morphKind === kind);
  return candidates.length === 1 ? candidates[0] : skillId;
}
