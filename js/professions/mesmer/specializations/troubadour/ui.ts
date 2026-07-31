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

const TROUBADOUR_MECHANIC_SKILLS = Object.freeze([
  ID.LIVELY_LUTE_ALTERNATE,
  ID.FLUSTERING_FLUTE,
  ID.DEAFENING_DRUM,
  ID.HARMONIOUS_HARP_ALTERNATE,
  ID.CRESCENDO,
]);

export const troubadourUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: MesmerUiContext) =>
      mesmerMechanicPaletteGroups(context, TROUBADOUR_MECHANIC_SKILLS),
    skillBarGroups: () =>
      mesmerMechanicSkillBarGroups("Instruments", TROUBADOUR_MECHANIC_SKILLS),
    resourceViews: (context: MesmerUiContext) =>
      mesmerResourceViews(context, {
        id: "notes",
        singular: "note",
        plural: "notes",
        maximum: 3,
      }),
  });
