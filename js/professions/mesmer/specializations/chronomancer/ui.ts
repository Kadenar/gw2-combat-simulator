import { MESMER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  mesmerMechanicPaletteGroups,
  mesmerMechanicSkillBarGroups,
  mesmerResourceViews,
} from "../../core/ui.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { MesmerUiContext } from "../../types.js";

const CHRONOMANCER_MECHANIC_SKILLS = Object.freeze([
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.DISTORTION,
  ID.CONTINUUM_SPLIT,
]);

export const chronomancerUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: MesmerUiContext) =>
      mesmerMechanicPaletteGroups(context, CHRONOMANCER_MECHANIC_SKILLS),
    skillBarGroups: () =>
      mesmerMechanicSkillBarGroups("Shatters", CHRONOMANCER_MECHANIC_SKILLS),
    resourceViews: (context: MesmerUiContext) =>
      mesmerResourceViews(context, {
        id: "clones",
        singular: "clone",
        plural: "clones",
        maximum: 3,
      }),
  });
