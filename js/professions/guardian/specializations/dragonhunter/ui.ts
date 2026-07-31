import { guardianUiSkillIdsByName } from "../../core/ui.js";
import type { GuardianUiContext } from "../../types.js";

const VIRTUE_NAMES = Object.freeze([
  "Spear of Justice",
  "Wings of Resolve",
  "Shield of Courage",
]);

export const dragonhunterUi = Object.freeze({
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: "guardian-f-keys",
      label: "F Keys",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
    },
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: "profession",
      label: "F",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      resourceAnchor: true,
    },
  ],
});
