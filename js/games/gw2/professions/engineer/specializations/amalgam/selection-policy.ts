import { canonicalGw2SkillId } from '#gw2/platform/skills/external-skill-ids.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { AmalgamMorphKind, AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

export const DEFAULT_AMALGAM_MORPHS = Object.freeze([
  ID.OFFENSIVE_PROTOCOL_SHRED,
  ID.DEFENSIVE_PROTOCOL_PROTECT,
  ID.OFFENSIVE_PROTOCOL_DEMOLISH
]);
const MORPH_ORDER: readonly AmalgamMorphKind[] = [
  'shred',
  'demolish',
  'obliterate',
  'pierce',
  'thorns',
  'cleanse',
  'protect'
];
type MorphCatalog = Pick<CanonicalCatalog<AmalgamSkill>, 'skills' | 'skillsById'>;

/** All three loadout positions draw from the same protocol list. */
function isProtocol(skill: AmalgamSkill | undefined): skill is AmalgamSkill {
  return skill?.specialization === 'Amalgam' && skill.morphKind != null;
}

/** Dropdown order follows protocol kind so changing display text cannot reorder choices. */
export function amalgamProtocolOptions<S extends AmalgamSkill>(catalog: Pick<CanonicalCatalog<S>, 'skills'>): S[] {
  return catalog.skills
    .filter(isProtocol)
    .sort((a, b) => MORPH_ORDER.indexOf(a.morphKind!) - MORPH_ORDER.indexOf(b.morphKind!));
}

/** Simulations may equip fewer than three protocols. Array order determines their buttons. */
export function distinctAmalgamMorphs(catalog: Pick<MorphCatalog, 'skillsById'>, ids: readonly number[]): boolean {
  return (
    ids.length <= 3 && new Set(ids).size === ids.length && ids.every((id) => isProtocol(catalog.skillsById.get(id)))
  );
}

/** A saved loadout fills all three protocol positions with distinct protocols. */
export function validAmalgamMorphs(catalog: MorphCatalog, value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 3 && distinctAmalgamMorphs(catalog, value);
}

/** Keep valid saved positions and fill vacant ones without taking another slot's selection. */
export function normalizeAmalgamMorphs(catalog: MorphCatalog, value: unknown): number[] {
  const saved = Array.isArray(value) ? value : [];
  const used = new Set<number>();
  const selected = DEFAULT_AMALGAM_MORPHS.map((_, index) => {
    const id = canonicalGw2SkillId(Number(saved[index]));

    if (!isProtocol(catalog.skillsById.get(id)) || used.has(id)) return null;

    used.add(id);
    return id;
  });
  return selected.map((id, index) => {
    if (id !== null) return id;

    const preferred = DEFAULT_AMALGAM_MORPHS[index];
    const replacement =
      isProtocol(catalog.skillsById.get(preferred)) && !used.has(preferred)
        ? preferred
        : amalgamProtocolOptions(catalog).find((skill) => !used.has(Number(skill.id)))?.id;

    if (replacement == null) throw new Error('Amalgam catalog cannot supply a unique morph for each slot.');

    used.add(Number(replacement));
    return Number(replacement);
  });
}

/** Moving an equipped protocol swaps the two slots. Rotation casts keep their skill IDs. */
export function selectAmalgamMorph(
  catalog: MorphCatalog,
  current: readonly number[],
  index: number,
  skillId: number
): number[] | null {
  if (
    ![0, 1, 2].includes(index) ||
    !isProtocol(catalog.skillsById.get(skillId)) ||
    !validAmalgamMorphs(catalog, current)
  )
    return null;

  const next = [...current];
  const previous = current.indexOf(skillId);

  if (previous >= 0) next[previous] = current[index];

  next[index] = skillId;
  return next;
}

const EVOLVE_SKILL_IDS = new Set<SkillId>([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]);

/** Both existing Evolve IDs and rotation names resolve to the currently selected Double Helix variant. */
export function resolveAmalgamSkillId(doubleHelix: boolean, skillId: SkillId): SkillId {
  if (
    !EVOLVE_SKILL_IDS.has(Number(skillId)) &&
    !['Evolve', 'Evolve (Base)', 'Evolve (Double Helix)'].includes(String(skillId))
  )
    return skillId;

  return doubleHelix ? ID.EVOLVE_DOUBLE_HELIX : ID.EVOLVE_BASE;
}
