import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { berserkerState } from "./state.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { WarriorCastContext } from "../../types.js";

function active(context: Gw2ModifierContext): boolean {
  const runtime = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { berserkActive?: boolean };
            };
          };
        }
      | undefined
  )?.profession;
  return (
    runtime?.specialization?.kind === "Berserker" &&
    Boolean(runtime.specialization.state?.berserkActive)
  );
}

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  if (active(context)) {
    result.power += 300;
    result.conditionDamage += 300;
  }
  if (hasTrait(context, TRAIT.BLOOD_REACTION)) {
    const factor = active(context) ? 0.14 : 0.07;
    result.ferocity += Number(result.precision || 0) * factor;
    result.conditionDamage += Number(result.power || 0) * factor;
  }
  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.bloody-roar",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BLOODY_ROAR) && active(context),
  },
]);

function modifyCastDuration(
  context: WarriorCastContext,
  duration: number,
): number {
  return berserkerState.from(context).berserkActive &&
    !context.hasBuff("quickness", context.start)
    ? duration / 1.15
    : duration;
}

export const berserkerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
export const berserkerCastRules = Object.freeze({ modifyCastDuration });
