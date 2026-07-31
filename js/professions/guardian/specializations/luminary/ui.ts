import {
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode,
} from "../../core/ui.js";
import type { PaletteSkillAvailability } from "../../../../platform/engine/types.js";
import type {
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
} from "../../types.js";

const VIRTUE_NAMES = Object.freeze([
  "Radiant Justice",
  "Radiant Resolve",
  "Radiant Courage",
  "Enter Radiant Forge",
]);

function professionState(
  context: GuardianUiContext,
): Partial<GuardianState> {
  return context.state?.profession || context.professionState || {};
}

export const luminaryUi = Object.freeze({
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
