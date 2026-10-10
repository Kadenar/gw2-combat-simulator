import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { type Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { activeBoonStacks as modifierBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Adds Applied Force power at the existing live attribute boundary. */
export function applyAppliedForceAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  const appliedForceProfile = requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE);
  return {
    ...attributes,
    power:
      (attributes.power || 0) +
      modifierBoonStacks(context, 'might', balanceProfileNumber(appliedForceProfile, 'maximumStacks')) *
        balanceProfileNumber(appliedForceProfile, 'attributePerStack')
  };
}
