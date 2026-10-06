import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey, Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import { modifyStormSpiritAttributes, signetOfTheWildBonus } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerStalkersStrikeModifier } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import {
  rangerHammerConditionsModifier,
  rangerHammerDisabledModifier
} from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';
import {
  ambidexterityAttributeDelta,
  applyArachnophobiaAttributes,
  applyLingeringMagicAttributes,
  applyViciousQuarryAttributes,
  applyWellspringPlayerAttributes,
  modifyRangerConditionBaseDuration,
  stridersStrengthAttributeDelta
} from '#gw2/professions/ranger/core/traits/behavior.js';
import { rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { honedAxesAttributeDelta } from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import {
  modifyRangerPetAttributes,
  rangerPetModifierRules
} from '#gw2/professions/ranger/core/traits/pet-modifiers.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

function modifyRangerAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);

  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = (result[attribute] || 0) + amount;
  };

  if (!rangerPetEvent(context)) {
    adjust('power', stridersStrengthAttributeDelta(context));
    adjust('ferocity', honedAxesAttributeDelta(context));
    adjust('conditionDamage', ambidexterityAttributeDelta(context));

    if (!staticRulesApplied) {
      applyWellspringPlayerAttributes(context, adjust);
    }

    applyViciousQuarryAttributes(context, adjust, staticRulesApplied);
  }

  // Shared base bonuses also apply to pet queries before their family-specific bonuses.
  if (!staticRulesApplied) {
    applyArachnophobiaAttributes(context, adjust);
    applyLingeringMagicAttributes(context, adjust);
  }

  modifyRangerPetAttributes(context, result, staticRulesApplied);

  const signetSelected = hasSelectedSkillId(context, ID.SIGNET_OF_THE_WILD);
  const signetReady = !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_THE_WILD, context.time);
  adjust(
    'ferocity',
    signetOfTheWildBonus(context, signetSelected, signetReady) -
      signetOfTheWildBonus(context, signetSelected && staticRulesApplied)
  );

  return result;
}

const rangerPlayerAndSharedModifierRules: readonly Gw2ModifierRule[] = [
  rangerHammerDisabledModifier,
  rangerPounceModifier,
  rangerFalconsStoopModifier,
  rangerStalkersStrikeModifier,
  rangerHammerConditionsModifier,
  rangerConsumingBiteModifier
];

// Keep player/shared and pet-audience collections distinct while preserving one public rule list.
const rangerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  rangerAttackOfOpportunityModifier,
  ...rangerPlayerAndSharedModifierRules.map((rule, index) => ({ ...rule, order: 15 + index })),
  ...rangerPetModifierRules.map((rule, index) => ({ ...rule, order: 30 + index }))
]);

export const rangerCoreModifiers = Object.freeze({
  modifyAttributes: [
    modifyRangerAttributes,
    // Resolve spirit Power after the ordinary Core, specialization, and trait attribute hooks (order 0).
    { id: 'ranger.storm-spirit-attributes', order: 1, handler: modifyStormSpiritAttributes }
  ],
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules
});
