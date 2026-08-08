import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import { rangerUiState } from "../../core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { RangerSkill, RangerUiContext } from "../../types.js";

const AVATAR_SKILLS = Object.freeze([
  ID.COSMIC_RAY,
  ID.SEED_OF_LIFE,
  ID.LUNAR_IMPACT,
  ID.REJUVENATING_TIDES,
  ID.NATURAL_CONVERGENCE,
]);

function availability(
  context: RangerUiContext,
  skill: RangerSkill,
): PaletteSkillAvailability {
  const state = rangerUiState(context);
  const active = Boolean(state.celestialAvatarActive);
  if (skill.id === ID.CELESTIAL_AVATAR) {
    if (active) {
      return {
        available: false,
        message: "Celestial Avatar is already active",
      };
    }
    if (Number(state.astralForce || 0) < 100) {
      return { available: false, message: "Requires full Astral Force" };
    }
  }
  if (skill.id === ID.RELEASE_CELESTIAL_AVATAR && !active) {
    return { available: false, message: "Celestial Avatar is not active" };
  }
  if (skill.celestialAvatarSkill && !active) {
    return { available: false, message: "Enter Celestial Avatar first" };
  }
  if (skill.type === "Weapon" && active && !skill.celestialAvatarSkill) {
    return {
      available: false,
      message: "Celestial Avatar replaces weapon skills",
    };
  }
  return { available: true, message: "" };
}

export const druidUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: (context: RangerUiContext) => [
      {
        id: "ranger-druid-f5",
        label: "Celestial Avatar",
        skillIds: [
          rangerUiState(context).celestialAvatarActive
            ? ID.RELEASE_CELESTIAL_AVATAR
            : ID.CELESTIAL_AVATAR,
        ],
        color: "#75c5c5",
      },
      {
        id: "ranger-celestial-avatar",
        label: "Avatar",
        skillIds: AVATAR_SKILLS,
        color: "#75c5c5",
      },
    ],
    paletteGroups: () => [
      {
        id: "ranger-druid-profession",
        label: "Avatar",
        skillIds: [
          ID.CELESTIAL_AVATAR,
          ID.RELEASE_CELESTIAL_AVATAR,
          ...AVATAR_SKILLS,
        ],
        color: "#75c5c5",
        resourceAnchor: true,
      },
    ],
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      return [
        {
          id: "astral-force",
          singular: "astral force",
          plural: "astral force",
          maximum: 100,
          value: Number(state.astralForce ?? context.initialAstralForce ?? 100),
          startMaximum: 100,
          startValue: Number(context.initialAstralForce ?? 100),
          canStart: true,
          buildKey: "initialAstralForce",
          step: 1,
          displayMode: "bar",
          shortLabel: "Astral Force",
          statusLabel: state.celestialAvatarActive
            ? "Celestial Avatar"
            : "Current",
        },
      ];
    },
    paletteSkillAvailability: availability,
  });
