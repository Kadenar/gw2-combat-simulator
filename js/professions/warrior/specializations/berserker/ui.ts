import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import { warriorPaletteGroups, warriorSkillBarGroups } from "../../core/ui.js";
import type { ProfessionUiContract } from "../../../../platform/engine/types.js";
import type { WarriorUiContext } from "../../types.js";

const SKILLS = Object.freeze([ID.BERSERK]);

export const berserkerUi: Partial<ProfessionUiContract> = Object.freeze({
  paletteGroups: (context: WarriorUiContext) =>
    warriorPaletteGroups(context, SKILLS),
  skillBarGroups: (context: WarriorUiContext) =>
    warriorSkillBarGroups(context, SKILLS),
});
