/**
 * Returns a catalog copy with one skill replaced by field overrides, or removed when the change is null. Every
 * lookup (by id, by name, and the ordered list) sees the same replacement.
 */
export function withSkill(catalog, id, change) {
  const current = catalog.skillsById.get(id);
  const replacement = change === null ? null : { ...current, ...change };
  const skills = (catalog.skills ?? []).flatMap((skill) =>
    skill.id === id ? (replacement ? [replacement] : []) : [skill]
  );
  const skillsById = new Map(catalog.skillsById);
  if (replacement) skillsById.set(id, replacement);
  else skillsById.delete(id);
  const skillsByName = new Map(catalog.skillsByName ?? []);
  if (current && skillsByName.get(current.name) === current) {
    if (replacement) skillsByName.set(current.name, replacement);
    else skillsByName.delete(current.name);
  }

  return { ...catalog, skills, skillsById, skillsByName };
}

/** Returns a catalog copy with one balance profile replaced by field overrides. */
export function withProfile(catalog, id, change) {
  const profile = { ...catalog.balanceProfilesById.get(id), ...change };
  const balanceProfiles = catalog.balanceProfiles.map((candidate) => (candidate.id === id ? profile : candidate));
  return {
    ...catalog,
    balanceProfiles,
    balanceProfilesById: new Map(balanceProfiles.map((candidate) => [candidate.id, candidate])),
    balanceProfilesByName: new Map(balanceProfiles.map((candidate) => [candidate.name, candidate]))
  };
}
