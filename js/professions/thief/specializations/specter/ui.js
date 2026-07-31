import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

const SHADOW_SHROUD_SKILL_IDS = Object.freeze([
  ID.HAUNT_SHOT,
  ID.GRASPING_SHADOWS,
  ID.DAWNS_REPOSE,
  ID.ETERNAL_NIGHT,
  ID.MIND_SHOCK,
]);

function stateFrom(context = {}) {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

export const specterUi = Object.freeze({
  paletteGroups: () => [{
    id: "thief-profession",
    label: "F",
    skillIds: [ID.SIPHON, ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD],
    color: "#9a535c",
    resourceAnchor: true,
  }, {
    id: "thief-shadow-shroud",
    label: "Shroud",
    skillIds: SHADOW_SHROUD_SKILL_IDS,
    color: "#6b9988",
  }],
  skillBarGroups: () => [{
    id: "specter-f-keys",
    label: "F Keys",
    skillIds: [ID.SIPHON, ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD],
    color: "#9a535c",
    layout: "thief-shadow-shroud",
  }, {
    id: "specter-shadow-shroud",
    label: "Shadow Shroud",
    skillIds: SHADOW_SHROUD_SKILL_IDS,
    color: "#6b9988",
    layout: "thief-shadow-shroud",
  }],
  resourceViews: context => {
    const state = stateFrom(context);
    return [{
      id: "shadow-force",
      singular: "shadow force",
      plural: "shadow force",
      maximum: 100,
      value: Number(state.shadowForce ?? context.initialShadowForce ?? 0),
      startMaximum: 100,
      startValue: Number(context.initialShadowForce ?? 0),
      canStart: true,
      buildKey: "initialShadowForce",
      step: 1,
      displayMode: "bar",
      shortLabel: "SF",
      statusLabel: state.shadowShroudActive ? "Shroud" : "Current",
    }];
  },
  paletteSkillAvailability: (context, skill) => {
    const state = stateFrom(context);
    if (skill.id === ID.ENTER_SHADOW_SHROUD) {
      const available =
        !state.shadowShroudActive && Number(state.shadowForce || 0) > 0;
      return {
        available,
        message: available
          ? ""
          : state.shadowShroudActive
            ? "Shadow Shroud is already active"
            : "Use Siphon or spend initiative to gain shadow force",
      };
    }
    if (skill.id === ID.EXIT_SHADOW_SHROUD) {
      return {
        available: Boolean(state.shadowShroudActive),
        message: state.shadowShroudActive ? "" : "Enter Shadow Shroud first",
      };
    }
    if (skill.shadowShroudSkill && !state.shadowShroudActive) {
      return { available: false, message: "Enter Shadow Shroud first" };
    }
    if (
      state.shadowShroudActive
      && !skill.shadowShroudSkill
      && (
        skill.type === "Weapon"
        || ["Heal", "Utility", "Elite"].includes(skill.type)
      )
    ) {
      return {
        available: false,
        message: "Shadow Shroud replaces weapon and slot skills",
      };
    }
    return { available: true, message: "" };
  },
});
