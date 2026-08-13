import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import { THIEF_DEADEYE_ASSUMPTION_CONTROLS } from "./assumptions.js";
import { deadeyeCastAvailability } from "./availability.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { ThiefSkill, ThiefState, ThiefUiContext } from "../../types.js";

function stateFrom(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as unknown as Partial<ThiefState>;
}

function professionSkillIds(context: ThiefUiContext = {}): number[] {
  const state = stateFrom(context);
  return [ID.DEADEYES_MARK, state.storedStolenSkillId]
    .filter((value) => value != null)
    .map(Number)
    .filter(Number.isFinite);
}

export const deadeyeUi = Object.freeze({
  assumptionControls: THIEF_DEADEYE_ASSUMPTION_CONTROLS,
  paletteGroups: (context: ThiefUiContext) => [
    {
      id: "thief-profession",
      label: "F",
      skillIds: professionSkillIds(context),
      color: "#9a535c",
      resourceAnchor: true,
    },
  ],
  skillBarGroups: () => [
    {
      id: "deadeye-stolen-skills",
      label: "Deadeye Stolen Skills",
      skillIds:
        THIEF_DEADEYE_ASSUMPTION_CONTROLS.filter(
          (control) => control.type === "select",
        )
          .flatMap((control) => control.options)
          .map((option) => Number(option.skillId))
          .filter(Number.isFinite) || [],
      color: "#9a535c",
    },
  ],
  resourceViews: (context: ThiefUiContext) => {
    const state = stateFrom(context);
    return [
      {
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
      },
    ];
  },
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const result = deadeyeCastAvailability(
      {
        state: { profession: stateFrom(context) },
      },
      skill,
    );
    return {
      available: result.ready,
      message: result.ready ? "" : result.reason,
    };
  },
});
