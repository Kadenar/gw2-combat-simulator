import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
} from "../../data/ids.js";
import { revenantUiState } from "../../core/ui.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { RevenantUiContext } from "../../types.js";

export const vindicatorUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: RevenantUiContext) => {
      const state = revenantUiState(context);
      return [
        {
          id: "revenant-profession-specialization",
          label: "F",
          skillIds: [SKILL.ALLIANCE_TACTICS, SKILL.ENERGY_MELD],
          color: "#a84f54",
          resourceAnchor: true,
        },
        ...(state.activeLegendId === LEGEND.ALLIANCE &&
        state.allianceSide === "kurzick"
          ? [{
              id: "revenant-alliance-kurzick",
              label: "Kurz",
              skillIds: [
                SKILL.SELFLESS_SPIRIT,
                SKILL.BATTLE_DANCE,
                SKILL.TREE_SONG,
                SKILL.AWAKENING,
                SKILL.URN_OF_SAINT_VIKTOR,
              ],
              color: "#7696c7",
            }]
          : []),
      ];
    },
    resourceViews: (context: RevenantUiContext) => {
      const state = revenantUiState(context);
      return [{
        id: "endurance",
        singular: "endurance",
        plural: "endurance",
        maximum: Number(state.maximumEndurance || 100),
        value: Number(state.endurance ?? 100),
        canStart: false,
        step: 1,
        displayMode: "bar",
        pipStyle: "endurance",
        shortLabel: "End",
        statusLabel: "Current",
        // Render the endurance meter beneath the Dodge button (which the
        // Vindicator dodge spends in one leap) instead of as a standalone bar.
        paletteSkillId: SKILL.DODGE,
      }];
    },
  });
