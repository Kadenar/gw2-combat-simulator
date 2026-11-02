/** Version six equips canonical glyph roots while preserving the elemental evidence in existing rotations. */
import type { UnvalidatedBuildRecord } from '#gw2/platform/builds/types.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { elementalistGlyphRoot } from '#gw2/professions/elementalist/data/glyphs.js';

export function migrateElementalistGlyphSelections(candidate: unknown, catalog: CanonicalCatalog): unknown {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;

  const saved = candidate as UnvalidatedBuildRecord;
  const migrated = structuredClone(saved);
  // The shared codec still owns shape validation; this migration changes only known glyph selections.
  for (const field of ['selectedSkillIds', 'selectedSkills'] as const) {
    const selected = migrated[field];

    if (!selected || typeof selected !== 'object' || Array.isArray(selected)) continue;

    const slots = selected as Record<string, unknown>;
    for (const [slot, value] of Object.entries(slots)) {
      if (field === 'selectedSkillIds' && (typeof value === 'number' || typeof value === 'string'))
        slots[slot] = elementalistGlyphRoot(value);
      else if (field === 'selectedSkills' && typeof value === 'string') {
        const skill = catalog.skills.find((entry) => entry.name === value);

        if (skill && elementalistGlyphRoot(skill.id) !== skill.id)
          slots[slot] = catalog.skillsById.get(elementalistGlyphRoot(skill.id))!.name;
      }
    }
  }

  return migrated;
}
