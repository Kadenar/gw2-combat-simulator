import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

export const firebrandModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.firebrand.imbued-haste-attributes',
    label: 'Imbued Haste',
    target: [
      MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
      MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      MODIFIER_TARGET.ATTRIBUTE_VITALITY
    ],
    operation: 'add',
    amount: (context) => {
      const staticApplied = attributeProvenance(context.config).professionStaticRulesApplied;
      const runtimeActive = guardianBoonActive(context, 'quickness');
      const staticallyActive = staticApplied && Boolean(context.config?.boons?.quickness);
      const imbuedHasteProfile = requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.IMBUED_HASTE);
      return (
        (Number(runtimeActive) - Number(staticallyActive)) * balanceProfileNumber(imbuedHasteProfile, 'attributeBonus')
      );
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.IMBUED_HASTE)
  }
]);
