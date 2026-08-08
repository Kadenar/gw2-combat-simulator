import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import { rangerUiState } from "../../core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { RangerSkill, RangerUiContext } from "../../types.js";

const BOW_SKILLS = Object.freeze([
  ID.KEEN_SHOT,
  ID.HAWKEYE,
  ID.BLUSTER,
  ID.FLEETING_ZEPHYR,
  ID.QUARRYS_PERIL,
  ID.PELT,
  ID.SUPERSONIC_ARROW,
]);

function availability(
  context: RangerUiContext,
  skill: RangerSkill,
): PaletteSkillAvailability {
  const state = rangerUiState(context);
  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return { available: false, message: "Cyclone Bow is not active" };
  }
  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return { available: false, message: "Cyclone Bow is already active" };
  }
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return { available: false, message: "Summon the Cyclone Bow first" };
  }
  if (Number(skill.arrowCost || 0) > Number(state.arrows || 0)) {
    return { available: false, message: `Requires ${skill.arrowCost} arrows` };
  }
  if (skill.id === ID.HAWKEYE && Number(state.windForce || 0) < 5) {
    return { available: false, message: "Requires 5 Wind Force" };
  }
  if (skill.id === ID.KEEN_SHOT && Number(state.windForce || 0) >= 5) {
    return { available: false, message: "Replaced by Hawkeye" };
  }
  if (
    state.cycloneBowActive &&
    skill.type === "Weapon" &&
    !skill.cycloneBowSkill
  ) {
    return {
      available: false,
      message: "Cyclone Bow replaces weapon skills",
    };
  }
  return { available: true, message: "" };
}

export const galeshotUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: (context: RangerUiContext) => [
      {
        id: "ranger-galeshot-f5",
        label: "Cyclone Bow",
        skillIds: [
          rangerUiState(context).cycloneBowActive
            ? ID.DISMISS_CYCLONE_BOW
            : ID.SUMMON_CYCLONE_BOW,
        ],
        color: "#67b4c4",
      },
      {
        id: "ranger-cyclone-bow",
        label: "Bow",
        skillIds: BOW_SKILLS,
        color: "#67b4c4",
      },
    ],
    paletteGroups: () => [
      {
        id: "ranger-galeshot-profession",
        label: "Cyclone Bow",
        skillIds: [
          ID.SUMMON_CYCLONE_BOW,
          ID.DISMISS_CYCLONE_BOW,
          ...BOW_SKILLS,
        ],
        color: "#67b4c4",
        resourceAnchor: true,
      },
    ],
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      return [
        {
          id: "arrows",
          singular: "arrow",
          plural: "arrows",
          maximum: 8,
          value: Number(state.arrows ?? context.initialArrows ?? 8),
          startMaximum: 8,
          startValue: Number(context.initialArrows ?? 8),
          canStart: true,
          buildKey: "initialArrows",
          step: 1,
          displayMode: "pips",
          pipStyle: "ranger-arrows",
          shortLabel: "Arrows",
          statusLabel: "Current",
        },
        {
          id: "wind-force",
          singular: "Wind Force",
          plural: "Wind Force",
          maximum: 5,
          value: Number(state.windForce || 0),
          startMaximum: 5,
          startValue: 0,
          canStart: false,
          displayMode: "pips",
          pipStyle: "ranger-wind-force",
          shortLabel: "Wind Force",
          statusLabel: state.cycloneBowActive ? "Cyclone Bow" : "Inactive",
        },
      ];
    },
    paletteSkillAvailability: availability,
  });
