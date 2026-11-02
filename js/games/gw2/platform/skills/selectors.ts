/** Selector inputs have no payload; callers read a concrete choice while commands retain the input identity. */
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Runtime and presentation share this lookup, so an unknown selection fails instead of showing another payload. */
export function resolveSkillSelector<TSkill extends Skill>(
  catalog: Pick<CanonicalCatalog<TSkill>, 'skillsById'>,
  skill: TSkill,
  selection: string
): TSkill {
  if (!skill.selector) return skill;

  const id = skill.selector[selection];
  const choice = id == null ? undefined : catalog.skillsById.get(id);

  if (!choice || choice.selector) throw new Error(`${skill.name} has no valid ${selection} choice.`);

  return choice;
}

/** Presentation with no named selection, such as a pending timeline row, shows the first authored choice. */
export function displayedSkill<TSkill extends Skill>(
  catalog: Pick<CanonicalCatalog<TSkill>, 'skillsById'>,
  skill: TSkill,
  selection?: string
): TSkill {
  if (!skill.selector) return skill;

  const [first = ''] = Object.keys(skill.selector);
  return resolveSkillSelector(catalog, skill, selection ?? first);
}

/** Only explicit selector families share highlights; ordinary loadout descendants retain separate identities. */
export function skillInputIdentity(catalog: Pick<CanonicalCatalog, 'skillsById'>, id: SkillId): SkillId {
  const owner = catalog.skillsById.get(id)?.loadoutSkillId;
  return owner != null && catalog.skillsById.get(owner)?.selector ? owner : id;
}
