import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { untamedState } from "./state.js";

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

export function untamedCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = untamedState.from(context);
  if (skill.name === "Unleash Ranger" && state.rangerUnleashed) {
    return deny(
      skill,
      "ranger.ranger-unleashed",
      "the ranger is already unleashed.",
    );
  }
  if (skill.name === "Unleash Pet" && !state.rangerUnleashed) {
    return deny(skill, "ranger.pet-unleashed", "the pet is already unleashed.");
  }
  if (skill.unleashedPetSkill && state.rangerUnleashed) {
    return deny(skill, "ranger.pet-not-unleashed", "Unleash Pet first.");
  }
  return { ready: true };
}

function rangerUnleashed(context: Gw2ModifierContext): boolean {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: { rangerUnleashed?: boolean };
        };
      }
    | undefined;
  return (
    profession?.specialization?.kind === "Untamed" &&
    profession.specialization.state?.rangerUnleashed === true
  );
}

export const untamedModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "ranger.vow-of-the-untamed",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.25,
    when: (context) =>
      rangerUnleashed(context) && hasTrait(context, TRAIT.VOW_OF_THE_UNTAMED),
  },
]);

export const untamedAttributeRules = Object.freeze({
  modifierRules: untamedModifierRules,
});
export const untamedCastRules = Object.freeze({
  availability: {
    id: "ranger.untamed-availability",
    order: 20,
    handler: untamedCastAvailability,
  },
});
