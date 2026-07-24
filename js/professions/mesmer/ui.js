import { MECHANIC_SKILLS } from "./data/mesmer-profession-data.js";

export function mesmerResourceDefinition(specialization) {
  if (specialization === "Virtuoso") {
    return { id: "blades", singular: "blade", plural: "blades", maximum: 5 };
  }
  if (specialization === "Troubadour") {
    return { id: "notes", singular: "note", plural: "notes", maximum: 3 };
  }
  return { id: "clones", singular: "clone", plural: "clones", maximum: 3 };
}

export function mesmerPaletteGroups(context = {}) {
  const specialization = context.specialization || context.config?.specialization || "Core";
  const names = [...(MECHANIC_SKILLS[specialization] || [])];
  return [
    {
      id: "profession",
      label: "Profession",
      skillIds: names
        .map(name => context.catalog?.skillsByName?.get(name)?.id)
        .filter(id => id != null),
    },
  ];
}

export function mesmerResourceView(context = {}) {
  const specialization = context.specialization || context.config?.specialization || "Core";
  const definition = mesmerResourceDefinition(specialization);
  const state = context.state?.profession || context.professionState || {};
  const value = definition.id === "clones"
    ? Number(state.clones?.length || 0)
    : Number(state.numericResource || context.value || 0);
  return {
    ...definition,
    value: Math.max(0, Math.min(definition.maximum, value)),
    canStart: definition.id !== "clones",
    shortLabel: definition.id === "clones"
      ? "Cln"
      : definition.singular.slice(0, 3),
    statusLabel: definition.id === "clones" ? "Active" : "Current",
  };
}

export const mesmerUi = Object.freeze({
  paletteGroups: mesmerPaletteGroups,
  resourceView: mesmerResourceView,
});
