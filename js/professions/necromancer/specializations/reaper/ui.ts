import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  necromancerCoreTargetHealthThresholds,
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups,
} from "../../core/ui.js";
import { createProfessionAssumptionControls } from "../../../../app/profession/assumptions.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { NecromancerUiContext } from "../../types.js";

const REAPER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: "permanentIceField",
    label: "Permanent ice field (testing)",
    type: "boolean",
    defaultValue: false,
    specializations: ["Reaper"],
  },
]);

export const reaperUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    assumptionControls: REAPER_ASSUMPTION_CONTROLS,
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
