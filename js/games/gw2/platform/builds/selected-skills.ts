/** Supports both simulation arrays and slot-keyed application build loadouts. */
export type Gw2SelectedSkillLoadout = readonly string[] | Readonly<Record<string, string>>;

const preparedSkillNames = new WeakMap<object, ReadonlySet<string>>();

/** Accepts nonempty skill names from supported containers and drops malformed entries at the build boundary. */
export function normalizeSelectedSkillNames(value: unknown): readonly string[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Readonly<Record<string, unknown>>)
      : [];
  return entries.filter((name): name is string => typeof name === 'string' && name.length > 0);
}

/** Provides membership queries without making callers repeat loadout-shape handling. */
export function selectedSkillNameSet(value: unknown): ReadonlySet<string> {
  if (value && typeof value === 'object') {
    const prepared = preparedSkillNames.get(value);
    if (prepared) return prepared;
  }

  return new Set(normalizeSelectedSkillNames(value));
}

/** Snapshot each simulation's loadout once; mutable editor inputs keep their uncached membership behavior. */
export function prepareSelectedSkillLoadout(value: Gw2SelectedSkillLoadout): readonly string[] {
  const names = Object.freeze(normalizeSelectedSkillNames(value));
  preparedSkillNames.set(names, new Set(names));
  return names;
}
