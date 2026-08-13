import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import { ELEMENTALIST_OVERLOAD_SKILL_IDS } from "../../data/ids.js";

export const tempestUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: () => [
      {
        id: "elementalist-tempest-overloads",
        label: "Overloads",
        skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
        color: "#cf6c42",
      },
    ],
    paletteGroups: () => [
      {
        id: "elementalist-tempest-overloads",
        label: "OL",
        skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
        color: "#cf6c42",
        resourceAnchor: true,
      },
    ],
  });
