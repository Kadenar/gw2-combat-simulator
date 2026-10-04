import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

export type AmalgamMorphKind = 'cleanse' | 'protect' | 'thorns' | 'demolish' | 'obliterate' | 'pierce' | 'shred';
/** Maps each slot identity to its protocol for strain and trait observers. */
export const AMALGAM_MORPH_KIND_BY_SKILL_ID: ReadonlyMap<SkillId, AmalgamMorphKind> = new Map([
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866, 'shred'],
  [ID.OFFENSIVE_PROTOCOL_SHRED, 'shred'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104, 'thorns'],
  [ID.DEFENSIVE_PROTOCOL_THORNS, 'thorns'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954, 'demolish'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901, 'obliterate'],
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE, 'obliterate'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285, 'cleanse'],
  [ID.DEFENSIVE_PROTOCOL_CLEANSE, 'cleanse'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005, 'pierce'],
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015, 'pierce'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203, 'protect'],
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358, 'protect']
]);

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
type MorphCatalog = Pick<CanonicalCatalog, 'skills' | 'skillsById'>;

/** Only known morph identities in their authored slots may participate in a loadout. */
function legalMorph(skill: Skill | undefined, slot = Number(skill?.mechanicSlot)): skill is Skill {
  return Boolean(
    skill &&
    AMALGAM_MORPH_KIND_BY_SKILL_ID.has(skill.id) &&
    skill.specialization === 'Amalgam' &&
    skill.categories?.includes('Morph') &&
    MORPH_SLOTS.includes(slot as 2 | 3 | 4) &&
    Number(skill.mechanicSlot) === slot
  );
}

/** Dropdown order follows protocol identity so changing display text cannot reorder choices. */
export function amalgamProtocolOptions<S extends Skill>(
  catalog: Pick<CanonicalCatalog<S>, 'skills'>,
  slot: number
): S[] {
  return catalog.skills
    .filter((skill) => legalMorph(skill, slot))
    .sort(
      (a, b) =>
        MORPH_ORDER.indexOf(AMALGAM_MORPH_KIND_BY_SKILL_ID.get(a.id)!) -
          MORPH_ORDER.indexOf(AMALGAM_MORPH_KIND_BY_SKILL_ID.get(b.id)!) || Number(a.id) - Number(b.id)
    );
}

/** Canonical loadouts contain three distinct kinds, one legal identity for each profession slot. */
export function validAmalgamMorphs(catalog: MorphCatalog, value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 3) return false;
  const skills = value.map((id) => catalog.skillsById.get(id));
  return (
    skills.every((skill) => legalMorph(skill)) &&
    new Set(skills.map((skill) => Number(skill.mechanicSlot))).size === 3 &&
    new Set(value.map((id) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id))).size === 3
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
    const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id)!;
    if (selected.has(slot) || kinds.has(kind)) continue;
    selected.set(slot, id);
    kinds.add(kind);
  }

  for (const slot of MORPH_SLOTS) {
    if (selected.has(slot)) continue;
    const candidates = [catalog.skillsById.get(DEFAULT_AMALGAM_MORPHS[slot - 2]), ...catalog.skills];
    const replacement = candidates.find(
      (skill) => legalMorph(skill, slot) && !kinds.has(AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id)!)
    );
    if (!replacement) throw new Error('Amalgam catalog cannot supply a unique morph for each slot.');
    selected.set(slot, Number(replacement.id));
    kinds.add(AMALGAM_MORPH_KIND_BY_SKILL_ID.get(replacement.id)!);
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
  const previousKind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(next[index]);
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId);
  const conflict = next.findIndex((id, other) => other !== index && AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id) === kind);
  if (conflict >= 0) {
    const replacement = amalgamProtocolOptions(catalog, conflict + 2).find(
      (skill) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id) === previousKind
    );
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
