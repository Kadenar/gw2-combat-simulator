import {
  THIEF_DEADEYE_ASSUMPTION_CONTROLS,
} from "./assumptions.js";
import { deadeyeCastAvailability } from "./availability.js";

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}

export const deadeyeUi = Object.freeze({
  assumptionControls: THIEF_DEADEYE_ASSUMPTION_CONTROLS,
  skillBarGroups: () => [{
    id: "deadeye-stolen-skills",
    label: "Deadeye Stolen Skills",
    skillIds: THIEF_DEADEYE_ASSUMPTION_CONTROLS
      .find(control => control.key === "deadeyeStolenSkillChoice")
      ?.options.map(option => Number(option.skillId))
      .filter(Number.isFinite) || [],
    color: "#9a535c",
  }],
  resourceViews: context => {
    const state = stateFrom(context);
    return [{
      id: "malice",
      singular: "malice",
      plural: "malice",
      maximum: Number(state.maximumMalice || 5),
      value: Number(state.malice || 0),
      canStart: false,
      step: 1,
      displayMode: "pips",
      pipStyle: "thief-malice",
      shortLabel: "Mal",
      statusLabel: "Current",
    }];
  },
  paletteSkillAvailability: (context, skill) => {
    const result = deadeyeCastAvailability({
      state: { profession: stateFrom(context) },
    }, skill);
    return {
      available: result.ready,
      message: result.ready ? "" : result.reason,
    };
  },
});
