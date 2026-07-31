import {
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode,
} from "../../core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionSkillBarGroup,
} from "../../../../platform/engine/types.js";
import type {
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
} from "../../types.js";

const VIRTUE_NAMES = Object.freeze([
  "Tome of Justice",
  "Tome of Resolve",
  "Tome of Courage",
  "Stow Tome",
]);

function professionState(
  context: GuardianUiContext,
): Partial<GuardianState> {
  return context.state?.profession || context.professionState || {};
}

function tomeGroups(
  context: GuardianUiContext,
): ProfessionSkillBarGroup[] {
  return [
    {
      id: "guardian-f-keys",
      label: "F Keys",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      className: "guardian-tome-f-keys",
      layout: "guardian-tomes",
    },
    ...[
      ["justice", "Tome of Justice", "#d26b46"],
      ["resolve", "Tome of Resolve", "#5dad7d"],
      ["courage", "Tome of Courage", "#6d96ce"],
    ].map(([tome, label, color]) => ({
      id: `guardian-tome-${tome}`,
      label,
      skillIds: guardianUiSkillsByMode("tome", tome),
      color,
      className: "guardian-tome-chapters",
      layout: "guardian-tomes",
    })),
  ];
}

export const firebrandUi = Object.freeze({
  skillBarGroups: tomeGroups,
  paletteGroups: (context: GuardianUiContext): ProfessionPaletteGroup[] => [
    {
      id: "profession",
      label: "F",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      resourceAnchor: true,
    },
    ...[
      ["justice", "F1", "#d26b46"],
      ["resolve", "F2", "#5dad7d"],
      ["courage", "F3", "#6d96ce"],
    ].map(([tome, label, color]) => ({
      id: `tome-${tome}`,
      label,
      skillIds: guardianUiSkillsByMode("tome", tome),
      color,
    })),
  ],
  paletteSkillAvailability: (
    context: GuardianUiContext,
    skill: GuardianSkill,
  ): PaletteSkillAvailability => {
    const state = professionState(context);
    if (skill.type === "Weapon" && state.activeTome) {
      return {
        available: false,
        message: "Weapon skills are unavailable while a tome is equipped",
      };
    }
    if (skill.tome && !state.activeTome) {
      return {
        available: false,
        message: "Equip this tome to use its chapter skills",
      };
    }
    if (skill.tome && state.activeTome !== skill.tome) {
      return {
        available: false,
        message: `Currently using the ${state.activeTome} tome`,
      };
    }
    const pageCost = Number(skill.pageCost || 1);
    if (skill.tome && Number(state.tomePages || 0) < pageCost) {
      return {
        available: false,
        message: `Requires ${pageCost} tome pages`,
      };
    }
    if (skill.name === "Stow Tome" && !state.activeTome) {
      return {
        available: false,
        message: "No tome is currently equipped",
      };
    }
    return { available: true, message: "" };
  },
  resourceViews: (context: GuardianUiContext) => {
    const state = professionState(context);
    const maximum = Number(state.maximumTomePages || 5);
    return [
      {
        id: "pages",
        singular: "page",
        plural: "pages",
        maximum,
        value: Number(state.tomePages ?? maximum),
        canStart: false,
        shortLabel: "Pgs",
        statusLabel: "Current",
      },
    ];
  },
});
