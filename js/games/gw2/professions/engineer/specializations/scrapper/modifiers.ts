import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { applyEngineerSharpshooterConditionDamage } from '#gw2/professions/engineer/core/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';

const scrapperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Object in Motion: +5% strike damage per active movement status (stability/swiftness/superspeed).
    // Multiplicative — three statuses = 1.05^3 ≈ +15.8%.
    id: 'engineer.object-in-motion',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damageFactorPerBoon: 1.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const count = ['stability', 'swiftness', 'superspeed'].filter(
        (kind) => activeBoonStacks(context, kind, 1) > 0
      ).length;
      return parameters.damageFactorPerBoon ** count;
    },
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.OBJECT_IN_MOTION)
  }
]);

// Applied Force (GM trait): each might stack (capped at 25) adds 30 flat power at cast time.
function modifyScrapperAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  const appliedForceProfile = requireBalanceProfileFromContext(context, PROFILE.appliedForce);
  const modified = {
    ...attributes,
    power:
      Number(attributes.power || 0) +
      activeBoonStacks(context, 'might', balanceProfileNumber(appliedForceProfile, 'maximumStacks')) *
        balanceProfileNumber(appliedForceProfile, 'attributePerStack')
  };
  // Core converts Power before Applied Force runs, so refresh Sharpshooter with the final Power.
  applyEngineerSharpshooterConditionDamage(context, modified);
  return modified;
}

export const scrapperModifiers = Object.freeze({
  modifyAttributes: modifyScrapperAttributes,
  modifierRules: scrapperModifierRules
});
