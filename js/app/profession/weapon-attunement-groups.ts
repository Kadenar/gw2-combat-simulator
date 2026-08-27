import type { Skill } from '../../platform/engine/types.js';

const ATTUNEMENT_ORDER = new Map(
  ['Fire', 'Water', 'Air', 'Earth', 'Dual', 'Special'].map((attunement, index) => [attunement, index])
);

export interface WeaponAttunementGroup {
  readonly attunement: string | null;
  readonly skills: Skill[];
}

export function weaponBarSkillStacks(skills: readonly Skill[], flattenSameSlots = false): Skill[][] {
  if (flattenSameSlots) return skills.map((skill) => [skill]);

  const bySlot = new Map<string, Skill[]>();
  for (const skill of skills) {
    const slot = String(skill.slot);
    const stack = bySlot.get(slot) || [];
    stack.push(skill);
    bySlot.set(slot, stack);
  }

  return [...bySlot.values()];
}

/**
 * Splits Elementalist-style weapon variants into one row per attunement.
 * Professions without multiple elemental rows keep the normal single-row bar.
 */
export function groupWeaponSkillsByAttunement(
  skills: readonly Skill[],
  specialization: string
): WeaponAttunementGroup[] {
  const byAttunement = new Map<string, Skill[]>();
  for (const skill of skills) {
    const skillAttunement = String(skill.attunement || 'Special');
    const attunement = specialization === 'Weaver' && skillAttunement.includes('+') ? 'Dual' : skillAttunement;
    const groupedSkills = byAttunement.get(attunement) || [];
    groupedSkills.push(skill);
    byAttunement.set(attunement, groupedSkills);
  }

  const elementalAttunementCount = [...byAttunement.keys()].filter((attunement) => attunement !== 'Special').length;

  if (elementalAttunementCount < 2) {
    return [{ attunement: null, skills: [...skills] }];
  }

  return [...byAttunement]
    .sort(
      ([left], [right]) =>
        (ATTUNEMENT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (ATTUNEMENT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
    )
    .map(([attunement, groupedSkills]) => ({
      attunement,
      skills: groupedSkills
    }));
}
