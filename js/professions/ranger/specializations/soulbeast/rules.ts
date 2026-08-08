import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { selectedRangerPet } from "../../core/state.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { soulbeastState } from "./state.js";

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function soulbeastCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  if (
    skill.beastmodeSkill &&
    !toggle &&
    !selectedRangerPet(context.config)?.beastmodeSkillIds.includes(skill.id)
  ) {
    return deny(
      skill,
      "ranger.inactive-merged-pet-skill",
      "select the pet that grants this merged Beast skill.",
    );
  }
  if (
    skill.beastmodeSkill &&
    !state.beastmodeActive &&
    skill.name !== "Beastmode"
  ) {
    return deny(skill, "ranger.beastmode-inactive", "enter Beastmode first.");
  }
  if (skill.name === "Beastmode" && state.beastmodeActive) {
    return deny(
      skill,
      "ranger.beastmode-active",
      "Beastmode is already active.",
    );
  }
  if (skill.name === "Leave Beastmode" && !state.beastmodeActive) {
    return deny(skill, "ranger.beastmode-inactive", "Beastmode is not active.");
  }
  return { ready: true };
}

export const soulbeastModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
    {
      id: "ranger.furious-strength",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, TRAIT.FURIOUS_STRENGTH) &&
        Boolean(context.config?.boons?.fury),
    },
    {
      id: "ranger.oppressive-superiority",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, TRAIT.OPPRESSIVE_SUPERIORITY) &&
        Number(context.config?.playerHealthFraction ?? 1) > 0.5,
    },
  ],
);

export const soulbeastAttributeRules = Object.freeze({
  modifierRules: soulbeastModifierRules,
});
export const soulbeastCastRules = Object.freeze({
  availability: {
    id: "ranger.soulbeast-availability",
    order: 20,
    handler: soulbeastCastAvailability,
  },
});
