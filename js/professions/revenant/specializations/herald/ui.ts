import { REVENANT_SKILL_IDS as SKILL } from "../../data/ids.js";
import {
  activeRevenantLegend,
  revenantUiState,
} from "../../core/ui.js";
import { HERALD_MECHANICS } from "./mechanics.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type { RevenantUiContext } from "../../types.js";

export const heraldUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: RevenantUiContext) => {
      const trueNatureId = (
        HERALD_MECHANICS.trueNatureConsumeByLegendId as Readonly<
          Record<string, SkillId>
        >
      )[activeRevenantLegend(context)];
      return [{
        id: "revenant-profession-specialization",
        label: "F",
        skillIds: [
          trueNatureId != null &&
          revenantUiState(context).availableFlips?.[trueNatureId]
            ? trueNatureId
            : SKILL.FACET_OF_NATURE,
        ],
        color: "#a84f54",
        resourceAnchor: true,
      }];
    },
    resourceViews: () => [],
  });
