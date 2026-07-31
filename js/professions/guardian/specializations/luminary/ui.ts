import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import {
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode,
} from "../../core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
} from "../../types.js";

function luminaryEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if ([
    "guardian.effulgent-activated",
    "guardian.effulgent-detonate",
  ].includes(event.type)) return null;
  if (
    event.type !== "guardian.radiant-forge-entered"
    && event.type !== "guardian.radiant-forge-exited"
  ) return undefined;
  const entered = event.type.endsWith("-entered");
  return {
    type: event.type,
    description:
      `RADIANT FORGE ${entered ? "ENTERED" : "EXITED"}` +
      `${event.automatic ? " [automatic]" : ""}`,
    className: "resource",
    order: 30,
    flags: [],
  };
}

const VIRTUE_NAMES = Object.freeze([
  "Radiant Justice",
  "Radiant Resolve",
  "Radiant Courage",
  "Enter Radiant Forge",
]);

function professionState(
  context: GuardianUiContext,
): Partial<GuardianState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

export const luminaryUi = Object.freeze({
  eventLogRow: luminaryEventLogRow,
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: "guardian-f-keys",
      label: "F Keys",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
    },
    {
      id: "guardian-radiant-forge",
      label: "Radiant Forge",
      skillIds: guardianUiSkillsByMode("radiantForgeSkill"),
      color: "#d6b85c",
    },
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: "profession",
      label: "F",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      resourceAnchor: true,
      stackId: "luminary-profession",
    },
    {
      id: "radiant-forge",
      label: "RF",
      skillIds: guardianUiSkillsByMode("radiantForgeSkill"),
      color: "#d6b85c",
      stackId: "luminary-profession",
    },
  ],
  paletteSkillAvailability: (
    context: GuardianUiContext,
    skill: GuardianSkill,
  ): PaletteSkillAvailability => {
    const state = professionState(context);
    if (skill.type === "Weapon" && state.radiantForge) {
      return {
        available: false,
        message: "Weapon skills are unavailable during Radiant Forge",
      };
    }
    if (skill.radiantForgeSkill && !state.radiantForge) {
      return {
        available: false,
        message: "Enter Radiant Forge to use this skill",
      };
    }
    if (skill.name === "Enter Radiant Forge" && state.radiantForge) {
      return {
        available: false,
        message: "Radiant Forge is already active",
      };
    }
    if (skill.name === "Exit Radiant Forge" && !state.radiantForge) {
      return {
        available: false,
        message: "Radiant Forge is not active",
      };
    }
    return { available: true, message: "" };
  },
});
