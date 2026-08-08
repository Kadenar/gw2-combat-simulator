import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import {
  warriorPaletteGroups,
  warriorSkillBarGroups,
  warriorUiState,
} from "../../core/ui.js";
import type {
  ProfessionResourceView,
  ProfessionUiContract,
} from "../../../../platform/engine/types.js";
import type { WarriorUiContext } from "../../types.js";

const PROFESSION_SKILLS = Object.freeze([
  ID.UNSHEATHE_GUNSABER,
  ID.SHEATHE_GUNSABER,
  ID.DRAGON_TRIGGER,
  ID.DRAGON_SLASH_FORCE,
  ID.DRAGON_SLASH_BOOST,
  ID.DRAGON_SLASH_REACH,
]);
const GUNSABER_SKILLS = Object.freeze([
  ID.SWIFT_CUT,
  ID.STEEL_DIVIDE,
  ID.EXPLOSIVE_THRUST,
  ID.BLOOMING_FIRE,
  ID.ARTILLERY_SLASH,
  ID.CYCLONE_TRIGGER,
  ID.BREAK_STEP,
]);

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    {
      id: "flow",
      singular: "flow",
      plural: "flow",
      maximum: 100,
      value: Number(state.flow ?? context.initialResource ?? 0),
      startMaximum: 100,
      startValue: Number(context.initialResource ?? 0),
      canStart: true,
      buildKey: "initialResource",
      step: 1,
      displayMode: "bar",
      shortLabel: "Flow",
      statusLabel: "Current",
    },
  ];
}

export const bladeswornUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) => [
    ...warriorPaletteGroups(context, PROFESSION_SKILLS),
    {
      id: "gunsaber",
      label: "Gun",
      skillIds: GUNSABER_SKILLS,
      color: "#c97645",
    },
  ],
  skillBarGroups: (context: WarriorUiContext) => [
    ...warriorSkillBarGroups(context, PROFESSION_SKILLS),
    {
      id: "warrior-gunsaber",
      label: "Gunsaber",
      skillIds: GUNSABER_SKILLS,
      color: "#c97645",
    },
  ],
  resourceViews: resources,
});
