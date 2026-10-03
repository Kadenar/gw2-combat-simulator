import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionWeaponSkillGroup } from '#gw2/platform/profession-presentation/types.js';

const ATTUNEMENT_ORDER = ['Fire', 'Water', 'Air', 'Earth', 'Dual', 'Special'];

/** Groups elemental variants in attunement order while leaving a single weapon bar unlabelled. */
export function elementalistWeaponGroups(
  skills: readonly Skill[],
  groupKey: (skill: Skill) => string = (skill) => String(skill.attunement || 'Special')
): ProfessionWeaponSkillGroup[] | null {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const label = groupKey(skill);
    groups.set(label, [...(groups.get(label) || []), skill]);
  }

  if ([...groups.keys()].filter((label) => label !== 'Special').length < 2) return null;
  const order = (label: string) =>
    ATTUNEMENT_ORDER.includes(label) ? ATTUNEMENT_ORDER.indexOf(label) : Number.MAX_SAFE_INTEGER;
  return [...groups]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([label, skills]) => ({
      id: label.toLowerCase().replace(/[^a-z]+/g, '-'),
      label,
      skills
    }));
}
