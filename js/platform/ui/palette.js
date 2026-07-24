export function paletteView(profession, context) {
  const groups = profession.ui.paletteGroups(context);
  if (!Array.isArray(groups)) throw new TypeError("paletteGroups must return an array.");
  return groups.map(group => ({
    id: String(group.id),
    label: String(group.label || group.id),
    skillIds: [...(group.skillIds || [])],
  }));
}
