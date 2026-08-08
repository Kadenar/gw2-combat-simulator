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

const CHANTS = Object.freeze([
  ID.CHANT_OF_ACTION,
  ID.CHANT_OF_RECUPERATION,
  ID.CHANT_OF_FREEDOM,
]);

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    {
      id: "motivation",
      singular: "motivation",
      plural: "motivation",
      maximum: 10,
      value: Number(state.motivation || 0),
      canStart: false,
      step: 1,
      displayMode: "bar",
      shortLabel: "Mot",
      statusLabel: "Current",
    },
  ];
}

export const paragonUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) =>
    warriorPaletteGroups(context, CHANTS),
  skillBarGroups: (context: WarriorUiContext) =>
    warriorSkillBarGroups(context, CHANTS),
  resourceViews: resources,
});
