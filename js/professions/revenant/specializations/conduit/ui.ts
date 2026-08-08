import { REVENANT_SKILL_IDS as SKILL } from "../../data/ids.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "../../legend-rules.js";
import { activeRevenantLegend, revenantUiState } from "../../core/ui.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type { RevenantUiContext } from "../../types.js";

const RELEASE_ID_BY_NAME: Readonly<Record<string, SkillId>> = Object.freeze({
  "Release Potential: Monk": SKILL.RELEASE_POTENTIAL_MONK,
  "Release Potential: Mesmer": SKILL.RELEASE_POTENTIAL_MESMER,
  "Release Potential: Dervish": SKILL.RELEASE_POTENTIAL_DERVISH,
  "Release Potential: Assassin": SKILL.RELEASE_POTENTIAL_ASSASSIN,
  "Release Potential: Warrior": SKILL.RELEASE_POTENTIAL_WARRIOR,
});

export const conduitUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: RevenantUiContext) => {
      const releaseName =
        REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeRevenantLegend(context)];
      const releaseId = releaseName ? RELEASE_ID_BY_NAME[releaseName] : null;
      return [
        {
          id: "revenant-profession-specialization",
          label: "F",
          skillIds: [
            ...(releaseId == null ? [] : [releaseId]),
            SKILL.COSMIC_WISDOM,
          ],
          color: "#a84f54",
          resourceAnchor: true,
        },
      ];
    },
    resourceViews: (context: RevenantUiContext) => [
      {
        id: "affinity",
        singular: "affinity",
        plural: "affinity",
        maximum: 5,
        value: Number(revenantUiState(context).affinity || 0),
        canStart: false,
        step: 1,
        displayMode: "pips",
        pipStyle: "revenant-affinity",
        shortLabel: "Aff",
        statusLabel: "Current",
      },
    ],
  });
