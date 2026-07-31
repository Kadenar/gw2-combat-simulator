import { flattenProfessionState } from "../../../platform/engine/profession.js";
import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../../app/simulation/randomness.js";
import {
  isMesmerBuildSkillAvailable,
  isMesmerContinuumSkillAvailable,
  mesmerMinimumResource,
} from "./availability.js";
import { MESMER_SKILL_IDS as ID } from "../data/ids.js";
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  MesmerProfessionState,
  MesmerResolverEvent,
  MesmerSkill,
  MesmerUiContext,
} from "../types.js";

export interface MesmerUiResourceDefinition {
  readonly id: "blades" | "notes" | "clones";
  readonly singular: string;
  readonly plural: string;
  readonly maximum: number;
}

type MesmerUiState = Partial<MesmerProfessionState> & {
  readonly resource?: number;
  readonly continuumActive?: boolean;
};

export function mesmerUiSpecialization(
  context: MesmerUiContext = {},
): string {
  return context.specialization || context.config?.specialization || "Core";
}

export function mesmerMechanicPaletteGroups(
  context: MesmerUiContext,
  skillIds: readonly SkillId[],
): ProfessionPaletteGroup[] {
  return [{
    id: "profession",
    label: "Profession",
    skillIds: skillIds.filter((id) => context.catalog?.skillsById?.has(id)),
    resourceAnchor: true,
  }];
}

export function mesmerMechanicSkillBarGroups(
  label: string,
  skillIds: readonly SkillId[],
): ProfessionSkillBarGroup[] {
  return [{
    id: `mesmer-${label.toLowerCase()}`,
    label,
    skillIds: [...skillIds],
    color: "#9b73c7",
  }];
}

export function mesmerResourceViews(
  context: MesmerUiContext,
  definition: MesmerUiResourceDefinition,
): ProfessionResourceView[] {
  const state = flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as MesmerUiState;
  const value =
    definition.id === "clones"
      ? Number(state.clones?.length ?? state.resource ?? context.value ?? 0)
      : Number(state.numericResource || context.value || 0);
  return [{
    ...definition,
    value: Math.max(0, Math.min(definition.maximum, value)),
    canStart: definition.id !== "clones",
    shortLabel:
      definition.id === "clones" ? "Cln" : definition.singular.slice(0, 3),
    statusLabel: definition.id === "clones" ? "Active" : "Current",
  }];
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
    description:
      `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
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

export function mesmerPaletteSkillAvailability(
  context: MesmerUiContext = {},
  skill: Skill,
): { available: boolean; message: string } {
  const mesmerSkill = skill as MesmerSkill;
  const specialization = mesmerUiSpecialization(context);
  const state = flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as MesmerUiState;
  if (
    !isMesmerBuildSkillAvailable(mesmerSkill, {
      specialization,
      weaponmasterTraining:
        context.build?.weaponmasterTraining ??
        context.config?.weaponmasterTraining ??
        true,
    })
  ) {
    return {
      available: false,
      message: `${skill.name} is unavailable for ${specialization}.`,
    };
  }
  if (
    !isMesmerContinuumSkillAvailable(
      mesmerSkill,
      Boolean(state.continuumActive),
    )
  ) {
    return {
      available: false,
      message: "Unavailable until Continuum Split is active",
    };
  }
  const minimum = mesmerMinimumResource(mesmerSkill);
  const available = Number(state.resource ?? Infinity) >= minimum;
  return {
    available,
    message: available ? "" : `Requires at least ${minimum} blade`,
  };
}

const CORE_MECHANIC_SKILLS = Object.freeze([
  ID.MIND_WRACK,
  ID.CRY_OF_FRUSTRATION,
  ID.DIVERSION,
  ID.DISTORTION,
]);

export const mesmerCoreUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    eventLogRow: mesmerEventLogRow,
    paletteGroups: (context: MesmerUiContext) =>
      mesmerUiSpecialization(context) === "Core"
        ? mesmerMechanicPaletteGroups(context, CORE_MECHANIC_SKILLS)
        : [],
    skillBarGroups: (context: MesmerUiContext) =>
      mesmerUiSpecialization(context) === "Core"
        ? mesmerMechanicSkillBarGroups("Shatters", CORE_MECHANIC_SKILLS)
        : [],
    resourceViews: (context: MesmerUiContext) =>
      mesmerUiSpecialization(context) === "Core"
        ? mesmerResourceViews(context, {
            id: "clones",
            singular: "clone",
            plural: "clones",
            maximum: 3,
          })
        : [],
    paletteSkillAvailability: mesmerPaletteSkillAvailability,
  });
