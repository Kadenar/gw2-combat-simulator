import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";

function motivation(context: Gw2ModifierContext): number {
  const specialization = (
    context.runtime as
      | {
          profession?: {
            specialization?: { kind?: string; state?: { motivation?: number } };
          };
        }
      | undefined
  )?.profession?.specialization;
  return specialization?.kind === "Paragon"
    ? Number(specialization.state?.motivation || 0)
    : 0;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.brisk-pacing",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context) => motivation(context) * 0.01,
    when: (context) => hasTrait(context, TRAIT.BRISK_PACING),
  },
]);

export const paragonAttributeRules = Object.freeze({ modifierRules });
