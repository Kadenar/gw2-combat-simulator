/** Glyph roots identify equipped inputs; their elemental records own executable, patchable combat data. */
import { resolveSkillSelector } from '#gw2/platform/skills/selectors.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

export const ELEMENTALIST_GLYPHS: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  [ID.GLYPH_OF_STORMS]: {
    Fire: ID.GLYPH_OF_STORMS_FIRE,
    Water: ID.GLYPH_OF_STORMS_WATER,
    Air: ID.GLYPH_OF_STORMS_AIR,
    Earth: ID.GLYPH_OF_STORMS_EARTH
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER]: {
    Fire: ID.GLYPH_OF_ELEMENTAL_POWER_FIRE,
    Water: ID.GLYPH_OF_ELEMENTAL_POWER_WATER,
    Air: ID.GLYPH_OF_ELEMENTAL_POWER_AIR,
    Earth: ID.GLYPH_OF_ELEMENTAL_POWER_EARTH
  }
};

const GLYPH_ROOTS = new Map(
  Object.entries(ELEMENTALIST_GLYPHS).flatMap(([root, variants]) =>
    Object.values(variants).map((id) => [id, Number(root)] as const)
  )
);

/** Save migration replaces equipped elemental variants with their selector input. */
export function elementalistGlyphRoot(id: SkillId): SkillId {
  return GLYPH_ROOTS.get(Number(id)) ?? id;
}

const validatedCatalogs = new WeakSet();

/** Enforce glyph rules beyond the shared selector contract, once per catalog so patched catalogs are also checked. */
export function validateElementalistGlyphs(catalog: Pick<CanonicalCatalog<ElementalistSkill>, 'skillsById'>): void {
  if (validatedCatalogs.has(catalog.skillsById)) return;

  const seen = new Set<SkillId>();
  for (const [id, variants] of Object.entries(ELEMENTALIST_GLYPHS)) {
    const root = catalog.skillsById.get(Number(id));

    if (
      !root ||
      root.type !== 'Utility' ||
      root.skillFamily !== 'Glyph' ||
      root.slotSelectable === false ||
      root.attunement ||
      !root.selector
    )
      throw new Error(`Invalid Elementalist glyph root ${id}.`);

    for (const element of Object.keys(ELEMENTALIST_ATTUNEMENT_SKILL_IDS)) {
      const variant = resolveSkillSelector(catalog, root, element);

      if (
        variants[element] !== variant.id ||
        variant.attunement !== element ||
        seen.has(variant.id) ||
        variant.type !== root.type ||
        variant.skillFamily !== root.skillFamily ||
        variant.slotSelectable !== false
      )
        throw new Error(`Invalid Elementalist glyph variant ${variants[element]}.`);

      seen.add(variant.id);
    }
  }

  validatedCatalogs.add(catalog.skillsById);
}
