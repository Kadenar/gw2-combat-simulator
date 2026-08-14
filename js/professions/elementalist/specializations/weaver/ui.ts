import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../../../platform/engine/types.js";
import { ELEMENTALIST_WEAVER_SKILL_IDS } from "../../data/ids.js";
import { getActiveTraits } from "../../data/traits-data.js";
import type { ElementalistBuildSpecialization } from "../../types.js";

function hasElementsOfRage(context: SchedulerRecord): boolean {
  const build = context.build as
    | { specializations?: readonly ElementalistBuildSpecialization[] }
    | undefined;
  return getActiveTraits(build?.specializations || []).some(
    (trait) => trait.name === "Elements of Rage",
  );
}

function unravelPaletteAvailability(
  context: SchedulerRecord,
  skill: Skill,
): PaletteSkillAvailability {
  if (skill.id !== ELEMENTALIST_WEAVER_SKILL_IDS.Unravel) {
    return { available: true, message: "" };
  }
  const available = hasElementsOfRage(context);
  return {
    available,
    message: available ? "" : "Requires Elements of Rage.",
  };
}

export const weaverUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: (context: SchedulerRecord) =>
      hasElementsOfRage(context)
        ? [
            {
              id: "elementalist-weaver-unravel",
              label: "Unravel",
              skillIds: [ELEMENTALIST_WEAVER_SKILL_IDS.Unravel],
              color: "#9b65c7",
              className: "elementalist-weaver-unravel",
            },
          ]
        : [],
    paletteGroups: (context: SchedulerRecord) =>
      hasElementsOfRage(context)
        ? [
            {
              id: "elementalist-weaver-unravel",
              label: "F5",
              skillIds: [ELEMENTALIST_WEAVER_SKILL_IDS.Unravel],
              color: "#9b65c7",
              className: "compact-resource-palette elementalist-weaver-unravel",
            },
          ]
        : [],
    paletteSkillAvailability: unravelPaletteAvailability,
  });
