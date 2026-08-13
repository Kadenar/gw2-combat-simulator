import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { activeBoonStacks, playerStrike } from "../../core/rule-helpers.js";
import { hasEngineerTrait } from "../../core/state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type { EngineerMaximumAmmoContext } from "../../types.js";
import { applyScrapperCastTraits } from "./traits.js";

export const scrapperSchedulerHooks = Object.freeze({
  afterCast: {
    id: "engineer.scrapper-traits",
    order: 30,
    handler: applyScrapperCastTraits,
  },
});

export const scrapperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "engineer.object-in-motion",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => {
      const count = ["stability", "swiftness", "superspeed"].filter(
        (kind) => activeBoonStacks(context, kind, 1) > 0,
      ).length;
      return 1.05 ** count;
    },
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.OBJECT_IN_MOTION),
  },
]);

function modifyScrapperAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  return {
    ...attributes,
    power:
      Number(attributes.power || 0) +
      activeBoonStacks(context, "might", 25) * 30,
  };
}

function modifyScrapperMaximumAmmo(
  context: EngineerMaximumAmmoContext,
  maximum: number,
): number {
  return context.skill?.name === "Function Gyro" &&
    hasEngineerTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(2, Number(maximum || 0))
    : maximum;
}

export const scrapperAttributeRules = Object.freeze({
  modifyAttributes: modifyScrapperAttributes,
  modifierRules: scrapperModifierRules,
});

export const scrapperCastRules = Object.freeze({
  modifyMaximumAmmo: modifyScrapperMaximumAmmo,
});
