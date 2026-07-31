import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  necromancerCoreTargetHealthThresholds,
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups,
} from "../../core/ui.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { NecromancerUiContext } from "../../types.js";

export const reaperUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(context, {
        entryId: ID.REAPERS_SHROUD,
        shroud: "reaper",
      }),
    skillBarGroups: (context: NecromancerUiContext) =>
      necromancerTransformSkillBarGroups(context, {
        entryId: ID.REAPERS_SHROUD,
        shroud: "reaper",
      }),
    targetHealthThresholds: (context: NecromancerUiContext) =>
      necromancerCoreTargetHealthThresholds(context).length ? [] : [0.5],
  });
