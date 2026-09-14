/** A selected skill may be persisted by name or embedded as a catalog-like value. */
export type Gw2SelectedSkillValue = string | Readonly<{ name: string }>;

/** Supports both simulation arrays and slot-keyed application build loadouts. */
export type Gw2SelectedSkillLoadout =
  readonly Gw2SelectedSkillValue[] | Readonly<Record<string, Gw2SelectedSkillValue>>;

const preparedSkillNames = new WeakMap<object, ReadonlySet<string>>();

function selectedSkillName(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  const name = (value as { readonly name?: unknown }).name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

/** Normalizes supported loadout containers while dropping malformed entries at the build boundary. */
export function normalizeSelectedSkillNames(value: unknown): readonly string[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Readonly<Record<string, unknown>>)
      : [];
  return entries.map(selectedSkillName).filter((name): name is string => name !== null);
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
