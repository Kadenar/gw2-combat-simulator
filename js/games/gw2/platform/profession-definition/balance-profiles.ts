import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';

export type BalanceProfileFields = Readonly<Record<string, unknown>>;

/** Defines trait balance data with the catalog metadata shared by every profession. */
export function defineTraitProfile(id: SkillId, name: string, fields: BalanceProfileFields = {}): BalanceProfile {
  return {
    id,
    name,
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [],
    ...fields
  };
}

export function defineSkillVariantProfile(
  id: SkillId,
  parentId: SkillId,
  name: string,
  fields?: BalanceProfileFields
): BalanceProfile;
export function defineSkillVariantProfile(id: SkillId, name: string, fields?: BalanceProfileFields): BalanceProfile;
/** Defines patchable skill-state data, retaining parentless mechanic variants when no cast owns the profile. */
export function defineSkillVariantProfile(
  id: SkillId,
  parentIdOrName: SkillId,
  nameOrFields: string | BalanceProfileFields = {},
  fields: BalanceProfileFields = {}
): BalanceProfile {
  const hasParent = typeof nameOrFields === 'string';
  const name = hasParent ? nameOrFields : String(parentIdOrName);
  const profileFields = hasParent ? fields : nameOrFields;

  return {
    id,
    ...(hasParent ? { parentId: parentIdOrName } : { categories: ['Skill variant'] }),
    name,
    profileKind: 'skill-variant',
    effects: [],
    ...profileFields
  };
}
