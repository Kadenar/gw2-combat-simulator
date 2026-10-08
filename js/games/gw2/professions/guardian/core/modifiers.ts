import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  guardianSignetPassiveActive,
  modifyGuardianConditionBaseDuration,
  perfectInscriptionsMultiplier
} from '#gw2/professions/guardian/core/traits/radiance/behavior.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

const guardianCoreModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    order: -15,
    id: 'guardian.bane-signet-power',
    label: 'Bane Signet',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    amount: (context) => {
      // Remove a precomputed passive during recharge, or add it while ready for raw supplied attributes.
      const passiveActive = guardianSignetPassiveActive(context, GUARDIAN_SKILL_IDS.BANE_SIGNET);
      const baneSignetPassiveProfile = requireBalanceProfileFromContext(context, 'guardian.core.bane-signet-passive');
      const amount =
        balanceProfileNumber(baneSignetPassiveProfile, 'attributeBonus') * perfectInscriptionsMultiplier(context);
      return (
        (Number(passiveActive) - Number(attributeProvenance(context.config).professionStaticRulesApplied)) * amount
      );
    },
    when: (context) => hasSelectedSkillId(context, ID.BANE_SIGNET)
  },
  {
    order: -14,
    id: 'guardian.signet-of-wrath-condition-damage',
    label: 'Signet of Wrath',
    target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
    operation: 'add',
    amount: (context) => {
      const passiveActive = guardianSignetPassiveActive(context, GUARDIAN_SKILL_IDS.SIGNET_OF_WRATH);
      const signetOfWrathPassiveProfile = requireBalanceProfileFromContext(
        context,
        'guardian.core.signet-of-wrath-passive'
      );
      const amount =
        balanceProfileNumber(signetOfWrathPassiveProfile, 'attributeBonus') * perfectInscriptionsMultiplier(context);
      return attributeProvenance(context.config).professionStaticRulesApplied
        ? passiveActive
          ? 0
          : -amount
        : passiveActive
          ? amount
          : 0;
    },
    when: (context) => hasSelectedSkillId(context, ID.SIGNET_OF_WRATH)
  }
]);

export const guardianCoreModifiers = Object.freeze({
  modifyConditionBaseDuration: modifyGuardianConditionBaseDuration,
  modifierRules: guardianCoreModifierRules
});
