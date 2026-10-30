/** Bind recorded and saved protocol IDs to the selected slot without changing protocol kind or inferring a loadout. */
import type { SkillId } from '#gw2/platform/skills/types.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';

export function resolveSelectedAmalgamMorphId(skillId: SkillId, selectedMorphIds: readonly SkillId[]): SkillId {
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId);

  if (kind == null) return skillId;

  const candidates = selectedMorphIds.filter((id) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id) === kind);
  return candidates.length === 1 ? candidates[0] : skillId;
}
