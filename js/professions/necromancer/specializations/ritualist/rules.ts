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
import { necromancerBalanceProfile } from "../../core/profiles.js";
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

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
    result.concentration += Number(
      necromancerBalanceProfile(context, PROFILE.boonOfCreation)
        ?.attributeBonus || 180,
    );
  }
  return result;
}

export const ritualistModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
    {
      id: "necromancer.essence-blast-active-spirits",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      parameters: { damagePerSpirit: 0.15 } as Readonly<Record<string, number>>,
      amount: (context, _target, parameters) =>
        Number(context.event?.activeSpirits || 0) * parameters.damagePerSpirit,
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
      // +2% per target condition and +20% if target is controlled; both are live-calibrated against EVTC
      parameters: {
        damagePerCondition: 0.02,
        controlledBonus: 0.2,
      } as Readonly<Record<string, number>>,
      amount: (context, _target, parameters) =>
        necromancerTargetConditionCount(context) *
          parameters.damagePerCondition +
        (necromancerTargetControlled(context) ? parameters.controlledBonus : 0),
      // Flag is set on Anguish autoattacks and summon barrage hits but NOT on innervate or Summon Spirits hits
      when: (context) => Boolean(context.event?.anguishConditionalDamage),
    },
    {
      id: "necromancer.spirits-strength",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.5,
      // order: 100 ensures this multiplicative trait applies after all additive stacking (Lingering Spirits, Anguish conditional, etc.)
      order: 100,
      when: (context) =>
        Boolean(
          (context.event?.actorType === "summon" ||
            context.event?.summonKind === "spirit") &&
          // Innervate attacks are player-buffed abilities, not spirit autonomous attacks; the trait does not apply to them
          context.event?.spiritAttackType !== "innervate" &&
          hasTrait(context, TRAIT.SPIRITS_STRENGTH),
        ),
    },
  ],
);

export const ritualistAttributeRules = Object.freeze({
  modifyAttributes: modifyRitualistAttributes,
  modifierRules: ritualistModifierRules,
});
