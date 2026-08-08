import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";

function insightStacks(context: Gw2ModifierContext): number {
  const profession = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { attackerInsightExpiries?: number[] };
            };
          };
        }
      | undefined
  )?.profession;
  if (profession?.specialization?.kind !== "Spellbreaker") return 0;
  return (
    profession.specialization.state?.attackerInsightExpiries || []
  ).filter((expiresAt) => expiresAt > context.time).length;
}

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const bonus = insightStacks(context) * 45;
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.pure-strike",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "add",
    amount: (context) => (context.config?.target?.boonless ? 0.14 : 0.07),
    when: (context) => hasTrait(context, TRAIT.PURE_STRIKE),
  },
  {
    id: "warrior.sun-and-moon-style",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.SUN_AND_MOON_STYLE) &&
      context.config?.target?.boonless === true,
  },
]);

export const spellbreakerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
