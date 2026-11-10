import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { AmalgamMorphKind, AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

export const DEFAULT_AMALGAM_MORPHS = Object.freeze([
  ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103,
  ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203,
  ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954
]);
const MORPH_SLOTS = [2, 3, 4] as const;
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

/** Only skills with a protocol kind in their authored slots may participate in a loadout. */
function legalMorph(skill: AmalgamSkill | undefined, slot = Number(skill?.mechanicSlot)): skill is AmalgamSkill {
  return Boolean(
    skill &&
    skill.morphKind != null &&
    skill.specialization === 'Amalgam' &&
    MORPH_SLOTS.includes(slot as 2 | 3 | 4) &&
    Number(skill.mechanicSlot) === slot
  );
}

/** Dropdown order follows protocol identity so changing display text cannot reorder choices. */
export function amalgamProtocolOptions<S extends AmalgamSkill>(
  catalog: Pick<CanonicalCatalog<S>, 'skills'>,
  slot: number
): S[] {
  return catalog.skills
    .filter((skill) => legalMorph(skill, slot))
    .sort(
      (a, b) => MORPH_ORDER.indexOf(a.morphKind!) - MORPH_ORDER.indexOf(b.morphKind!) || Number(a.id) - Number(b.id)
    );
}

/** Canonical loadouts contain three distinct kinds, one legal identity for each profession slot. */
export function validAmalgamMorphs(catalog: MorphCatalog, value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 3) return false;

  const skills = value.map((id) => catalog.skillsById.get(id));
  return (
    skills.every((skill) => legalMorph(skill)) &&
    new Set(skills.map((skill: AmalgamSkill) => Number(skill.mechanicSlot))).size === 3 &&
    new Set(skills.map((skill) => skill.morphKind)).size === 3
  );
}

/** Retain legal saved choices before filling vacant slots, comparing kinds rather than labels. */
export function normalizeAmalgamMorphs(catalog: MorphCatalog, value: unknown): number[] {
  const selected = new Map<number, number>();
  const kinds = new Set<AmalgamMorphKind>();
  for (const rawId of Array.isArray(value) ? value : DEFAULT_AMALGAM_MORPHS) {
    const id = Number(rawId);
    const skill = catalog.skillsById.get(id);

    if (!legalMorph(skill)) continue;

    const slot = Number(skill.mechanicSlot);
    const kind = skill.morphKind!;

    if (selected.has(slot) || kinds.has(kind)) continue;

    selected.set(slot, id);
    kinds.add(kind);
  }

  for (const slot of MORPH_SLOTS) {
    if (selected.has(slot)) continue;

    const candidates = [catalog.skillsById.get(DEFAULT_AMALGAM_MORPHS[slot - 2]), ...catalog.skills];
    const replacement = candidates.find((skill) => legalMorph(skill, slot) && !kinds.has(skill.morphKind!));

    if (!replacement) throw new Error('Amalgam catalog cannot supply a unique morph for each slot.');

    selected.set(slot, Number(replacement.id));
    kinds.add(replacement.morphKind!);
  }

  return MORPH_SLOTS.map((slot) => selected.get(slot)!);
}

/** Swap a conflicting kind into the previous kind's slot without mutating a rejected selection. */
export function selectAmalgamMorph(
  catalog: MorphCatalog,
  current: readonly number[],
  index: number,
  skillId: number
): number[] | null {
  if (
    ![0, 1, 2].includes(index) ||
    !legalMorph(catalog.skillsById.get(skillId), index + 2) ||
    !validAmalgamMorphs(catalog, current)
  )
    return null;

  const next = normalizeAmalgamMorphs(catalog, current);
  const previousKind = catalog.skillsById.get(next[index])?.morphKind;
  const kind = catalog.skillsById.get(skillId)?.morphKind;
  const conflict = next.findIndex((id, other) => other !== index && catalog.skillsById.get(id)?.morphKind === kind);

  if (conflict >= 0) {
    const replacement = amalgamProtocolOptions(catalog, conflict + 2).find((skill) => skill.morphKind === previousKind);

    if (!replacement) return null;

    next[conflict] = Number(replacement.id);
  }

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
