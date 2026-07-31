import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups,
} from "../../core/ui.js";
import { getActiveTraits } from "../../data/traits-data.js";
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  NecromancerSkill,
  NecromancerUiContext,
} from "../../types.js";

const SCOURGE_SKILLS = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD,
]);

function scourgeSkillBarIds(
  context: NecromancerUiContext,
): readonly (string | number)[] {
  const selectedTraits = new Set(
    getActiveTraits(context.build?.specializations || []).map(
      (trait) => trait.name,
    ),
  );
  return [
    ID.MANIFEST_SAND_SHADE,
    ID.NEFARIOUS_FAVOR,
    ID.SAND_CASCADE,
    ID.GARISH_PILLAR,
    selectedTraits.has("Herald of Sorrow")
      ? ID.SANDSTORM_SHROUD
      : ID.DESERT_SHROUD,
  ];
}

function scourgePaletteAvailability(
  context: NecromancerUiContext,
  skill: NecromancerSkill,
): PaletteSkillAvailability {
  const selectedTraits = new Set(
    getActiveTraits(context.build?.specializations || []).map(
      (trait) => trait.name,
    ),
  );
  if (
    skill.id === ID.SANDSTORM_SHROUD &&
    !selectedTraits.has("Herald of Sorrow")
  ) {
    return { available: false, message: "Requires Herald of Sorrow" };
  }
  if (
    skill.id === ID.DESERT_SHROUD &&
    selectedTraits.has("Herald of Sorrow")
  ) {
    return {
      available: false,
      message: "Replaced by Sandstorm Shroud",
    };
  }
  return { available: true, message: "" };
}

export const scourgeUi:
  Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(context, {
        professionSkillIds: SCOURGE_SKILLS,
      }),
    skillBarGroups: (context: NecromancerUiContext) =>
      necromancerTransformSkillBarGroups(context, {
        professionSkillIds: scourgeSkillBarIds(context),
      }),
    paletteSkillAvailability: scourgePaletteAvailability,
  });
