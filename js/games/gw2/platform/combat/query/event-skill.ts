import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

/**
 * Resolves the catalog skill associated with an event. Stable ids take
 * precedence; name lookup supports older and generated event streams.
 */
export function skillForEvent(
  catalog: Partial<Pick<CanonicalCatalog, 'skillsById' | 'skillsByName'>>,
  event: { readonly skillId?: SkillId | null; readonly sourceId?: SkillId; readonly skillName?: string }
): Skill | undefined {
  const id = event.skillId ?? event.sourceId;
  return (id == null ? undefined : catalog.skillsById?.get(id)) ?? catalog.skillsByName?.get(event.skillName || '');
}
