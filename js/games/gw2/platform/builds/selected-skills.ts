import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Editor slots retain empties; runtime selections are flat immutable ID snapshots. */
export type Gw2SelectedSkillSlots = Record<string, SkillId | null>;
export type Gw2SelectedSkillLoadout = readonly SkillId[];

const preparedSkillIds = new WeakMap<object, ReadonlySet<SkillId>>();

/** Reject malformed identities without coercing string IDs or resolving display names. */
function checkedId(value: unknown): SkillId {
  if ((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length > 0))
    return value;
  throw new TypeError('Selected skills must contain canonical skill IDs.');
}

/** Flatten editor slots explicitly, omitting only the canonical empty-slot value. */
export function selectedSkillIdsFromSlots(value: unknown): SkillId[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('selectedSkillIds must be a slot record.');
  return Object.values(value)
    .filter((id) => id !== null)
    .map(checkedId);
}

/** Reuse prepared membership while leaving mutable editor inputs uncached. */
export function selectedSkillIdSet(
  value: readonly SkillId[] | Readonly<Gw2SelectedSkillSlots> | undefined
): ReadonlySet<SkillId> {
  if (value === undefined) return new Set();
  const prepared = preparedSkillIds.get(value);
  if (prepared) return prepared;
  return new Set(Array.isArray(value) ? value.map(checkedId) : selectedSkillIdsFromSlots(value));
}

/** Validate the catalog boundary and isolate simulation membership from subsequent editor mutations. */
export function prepareSelectedSkillLoadout(
  value: unknown,
  catalog: Pick<CanonicalCatalog, 'skillsById'>
): readonly SkillId[] {
  if (!Array.isArray(value)) throw new TypeError('Simulation selectedSkillIds must be an array of canonical IDs.');
  const ids = Object.freeze(
    value.map((value) => {
      const id = checkedId(value);
      if (!catalog.skillsById.has(id)) throw new TypeError(`Unknown selected skill ID: ${id}.`);
      return id;
    })
  );
  preparedSkillIds.set(ids, new Set(ids));
  return ids;
}

/** Shares build eligibility across selectors, palette, and casts; Weaponmaster Training is always active. */
export function isBuildSkillAvailable(
  skill: Skill,
  { specialization }: { readonly specialization?: string } = {}
): boolean {
  if (skill.simulatorExcluded) return false;
  if (skill.type === 'Weapon') return true;
  return !skill.specialization || skill.specialization === specialization;
}
