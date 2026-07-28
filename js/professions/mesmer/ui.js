import { MECHANIC_SKILLS } from "./mechanics/skill-mechanics.js";

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
    ? Number(state.clones?.length ?? state.resource ?? context.value ?? 0)
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

const MESMER_EVENT_ROWS = Object.freeze({
  "mesmer.phantasm-summoned": event => ({
    type: event.type,
    description: `PHANTASM SUMMONED ${event.name} x${event.count}`,
    className: "phantasm",
    order: 20,
    flags: ["phantasm-clone"],
  }),
  "mesmer.phantasm-resummoned": event => ({
    type: event.type,
    description:
      `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
    className: "phantasm",
    order: 21,
    flags: ["phantasm-clone"],
  }),
  "mesmer.phantasm-attack": event => ({
    type: event.type,
    description:
      `PHANTASM DAMAGE COMPLETE ${event.name} x${event.count}`
      + `${event.repeat ? " [repeat]" : ""}`,
    className: "phantasm",
    order: 22,
    flags: ["phantasm-clone"],
  }),
  "mesmer.instrument": event => ({
    type: "trigger",
    description:
      `INSTRUMENT ${event.instrument}`
      + `${
        event.expiresAt
          ? ` until ${Number(event.expiresAt).toFixed(3)}s`
          : ""
      }`,
    className: "trigger",
    order: 55,
    flags: [],
  }),
});

export function mesmerEventLogRow(_context, event) {
  const present = MESMER_EVENT_ROWS[event?.type];
  return present ? present(event) : undefined;
}

export const mesmerUi = Object.freeze({
  eventLogRow: mesmerEventLogRow,
  paletteGroups: mesmerPaletteGroups,
  resourceView: mesmerResourceView,
  resourceViews: context => [mesmerResourceView(context)],
});
