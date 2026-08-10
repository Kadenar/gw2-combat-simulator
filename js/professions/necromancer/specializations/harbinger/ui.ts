import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerTransformSkillBarGroups,
  necromancerUiState,
} from "../../core/ui.js";
import type {
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { NecromancerUiContext } from "../../types.js";

export const harbingerUi:
  Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(context, {
        entryId: ID.HARBINGER_SHROUD,
        shroud: "harbinger",
        stackId: "harbinger-profession",
      }),
    skillBarGroups: (context: NecromancerUiContext) =>
      necromancerTransformSkillBarGroups(context, {
        entryId: ID.HARBINGER_SHROUD,
        shroud: "harbinger",
      }),
    resourceViews: (
      context: NecromancerUiContext,
    ): ProfessionResourceView[] => [
      {
        id: "blight",
        singular: "blight",
        plural: "blight",
        maximum: 25,
        value: Number(
          necromancerUiState(context).blight ?? context.initialBlight ?? 0
        ),
        canStart: true,
        buildKey: "initialBlight",
        step: 1,
        displayMode: "bar",
        shortLabel: "Blt",
        statusLabel: "Current",
      },
      ...necromancerSoulShardResourceViews(context),
    ],
  });
