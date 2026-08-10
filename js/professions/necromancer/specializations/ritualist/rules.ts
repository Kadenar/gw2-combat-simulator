import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  cloneNecromancerAttributes,
  necromancerEventSkill,
  necromancerRuntimeSpecializationState,
  necromancerTargetConditionCount,
  necromancerTargetControlled,
} from "../../core/rules.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";

export { ritualistSchedulerHooks } from "./spirits.js";

function modifyRitualistAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (
    !professionStaticRulesApplied(context.config) &&
    hasTrait(context, TRAIT.BOON_OF_CREATION)
  ) {
    result.concentration += 180;
  }
  return result;
}

export const ritualistModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
    {
      id: "necromancer.essence-blast-active-spirits",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        Number(context.event?.activeSpirits || 0) *
        Number(context.event?.essenceBlastDamagePerSpirit || 0),
      when: (context) =>
        Boolean(
          necromancerEventSkill(context)?.id === ID.ESSENCE_BLAST &&
          Number(context.event?.activeSpirits || 0) > 0,
        ),
    },
    {
      id: "necromancer.lingering-spirits",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.05,
      when: (context) =>
        hasTrait(context, TRAIT.LINGERING_SPIRITS) &&
        Boolean(
          necromancerRuntimeSpecializationState(context).activeSpirits?.anguish,
        ),
    },
    {
      id: "necromancer.anguish-conditional-damage",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        necromancerTargetConditionCount(context) * 0.02 +
        (necromancerTargetControlled(context) ? 0.2 : 0),
      when: (context) => Boolean(context.event?.anguishConditionalDamage),
    },
    {
      id: "necromancer.spirits-strength",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.5,
      order: 100,
      when: (context) =>
        Boolean(
          (context.event?.actorType === "summon" ||
            context.event?.summonKind === "spirit") &&
          hasTrait(context, TRAIT.SPIRITS_STRENGTH),
        ),
    },
  ],
);

export const ritualistAttributeRules = Object.freeze({
  modifyAttributes: modifyRitualistAttributes,
  modifierRules: ritualistModifierRules,
});
