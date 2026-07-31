import { REVENANT_SKILL_IDS as SKILL } from "../../data/ids.js";
import { revenantUiState } from "../../core/ui.js";
import { isBandTogetherReady } from "./renegade.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  RevenantSkill,
  RevenantUiContext,
} from "../../types.js";

export const renegadeUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: () => [{
      id: "revenant-profession-specialization",
      label: "F",
      skillIds: [
        SKILL.HEROIC_COMMAND,
        SKILL.CITADEL_BOMBARDMENT,
        SKILL.ORDERS_FROM_ABOVE,
      ],
      color: "#a84f54",
      resourceAnchor: true,
    }],
    isPaletteSkillInstant: (
      context: RevenantUiContext,
      skill: RevenantSkill,
    ) =>
      skill.handlerId === "revenant.band-together" &&
      isBandTogetherReady(
        revenantUiState(context),
        Number(context.time || 0),
      ),
    resourceViews: () => [],
  });
