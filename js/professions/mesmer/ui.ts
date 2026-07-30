import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../app/simulation/randomness.js";
import { MECHANIC_SKILLS } from "./mechanics/skill-mechanics.js";
import {
  isMesmerBuildSkillAvailable,
  isMesmerContinuumSkillAvailable,
  mesmerMinimumResource,
} from "./mechanics/availability.js";
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type {
  MesmerResolverEvent,
  MesmerSkill,
  MesmerUiContext,
} from "./types.js";

interface MesmerUiResourceDefinition {
  readonly id: "blades" | "notes" | "clones";
  readonly singular: string;
  readonly plural: string;
  readonly maximum: number;
}

/**
 * Mesmer adapter for the shared simulator UI.
 *
 * This module maps specialization mechanics into profession skill groups,
 * describes clones, blades, or notes as UI resources, and formats
 * Mesmer-specific phantasm and instrument events. Combat behavior remains in
 * the Mesmer mechanics and resolver modules.
 */

export function mesmerResourceDefinition(
  specialization: string,
): MesmerUiResourceDefinition {
  if (specialization === "Virtuoso") {
    return { id: "blades", singular: "blade", plural: "blades", maximum: 5 };
  }
  if (specialization === "Troubadour") {
    return { id: "notes", singular: "note", plural: "notes", maximum: 3 };
  }
  return { id: "clones", singular: "clone", plural: "clones", maximum: 3 };
}

export function mesmerPaletteGroups(
  context: MesmerUiContext = {},
): ProfessionPaletteGroup[] {
  const specialization =
    context.specialization || context.config?.specialization || "Core";
  const skillIds = [...(MECHANIC_SKILLS[specialization] || [])];
  return [
    {
      id: "profession",
      label: "Profession",
      skillIds: skillIds.filter((id) => context.catalog?.skillsById?.has(id)),
      resourceAnchor: true,
    },
  ];
}

export function mesmerResourceView(
  context: MesmerUiContext = {},
): ProfessionResourceView {
  const specialization =
    context.specialization || context.config?.specialization || "Core";
  const definition = mesmerResourceDefinition(specialization);
  const state = context.state?.profession || context.professionState || {};
  const value =
    definition.id === "clones"
      ? Number(state.clones?.length ?? state.resource ?? context.value ?? 0)
      : Number(state.numericResource || context.value || 0);
  return {
    ...definition,
    value: Math.max(0, Math.min(definition.maximum, value)),
    canStart: definition.id !== "clones",
    shortLabel:
      definition.id === "clones" ? "Cln" : definition.singular.slice(0, 3),
    statusLabel: definition.id === "clones" ? "Active" : "Current",
  };
}

const MESMER_EVENT_ROWS: Readonly<
  Record<
    string,
    (event: MesmerResolverEvent) => ProfessionEventLogDescriptor
  >
> = Object.freeze({
  "mesmer.phantasm-summoned": (event) => ({
    type: event.type,
    description: `PHANTASM SUMMONED ${event.name} x${event.count}`,
    className: "phantasm",
    order: 20,
    flags: ["phantasm-clone"],
  }),
  "mesmer.phantasm-resummoned": (event) => ({
    type: event.type,
    description: `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
    className: "phantasm",
    order: 21,
    flags: ["phantasm-clone"],
  }),
  "mesmer.phantasm-attack": (event) => ({
    type: event.type,
    description:
      `PHANTASM DAMAGE COMPLETE ${event.name} x${event.count}` +
      `${event.repeat ? " [repeat]" : ""}`,
    className: "phantasm",
    order: 22,
    flags: ["phantasm-clone"],
  }),
  "mesmer.instrument": (event) => ({
    type: "trigger",
    description:
      `INSTRUMENT ${event.instrument}` +
      `${
        event.expiresAt ? ` until ${Number(event.expiresAt).toFixed(3)}s` : ""
      }`,
    className: "trigger",
    order: 55,
    flags: [],
  }),
});

export function mesmerEventLogRow(
  _context: SchedulerRecord,
  event: MesmerResolverEvent,
): ProfessionEventLogDescriptor | undefined {
  const present = MESMER_EVENT_ROWS[event?.type];
  return present ? present(event) : undefined;
}

export function isMesmerPaletteSkillAvailable(
  context: MesmerUiContext = {},
  skill: Skill,
): boolean {
  const mesmerSkill = skill as MesmerSkill;
  const specialization =
    context.specialization || context.config?.specialization || "Core";
  const config = {
    specialization,
    weaponmasterTraining:
      context.build?.weaponmasterTraining ??
      context.config?.weaponmasterTraining ??
      true,
  };
  if (!isMesmerBuildSkillAvailable(mesmerSkill, config)) return false;
  const state = context.state?.profession || context.professionState || {};
  if (
    !isMesmerContinuumSkillAvailable(
      mesmerSkill,
      Boolean(state.continuumActive),
    )
  ) {
    return false;
  }
  return (
    Number(state.resource ?? Infinity) >=
    mesmerMinimumResource(mesmerSkill)
  );
}

export function mesmerPaletteSkillUnavailableMessage(
  context: MesmerUiContext = {},
  skill: Skill,
): string {
  const mesmerSkill = skill as MesmerSkill;
  const specialization =
    context.specialization || context.config?.specialization || "Core";
  const state = context.state?.profession || context.professionState || {};
  if (
    !isMesmerBuildSkillAvailable(mesmerSkill, {
      specialization,
      weaponmasterTraining:
        context.build?.weaponmasterTraining ??
        context.config?.weaponmasterTraining ??
        true,
    })
  ) {
    return `${skill.name} is unavailable for ${specialization}.`;
  }
  if (
    !isMesmerContinuumSkillAvailable(
      mesmerSkill,
      Boolean(state.continuumActive),
    )
  ) {
    return "Unavailable until Continuum Split is active";
  }
  const minimum = mesmerMinimumResource(mesmerSkill);
  return Number(state.resource ?? Infinity) < minimum
    ? `Requires at least ${minimum} blade`
    : "";
}

export const mesmerUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  eventLogRow: mesmerEventLogRow,
  paletteGroups: mesmerPaletteGroups,
  isPaletteSkillAvailable: isMesmerPaletteSkillAvailable,
  paletteSkillUnavailableMessage: mesmerPaletteSkillUnavailableMessage,
  resourceViews: (context: MesmerUiContext) => [
    mesmerResourceView(context),
  ],
});
