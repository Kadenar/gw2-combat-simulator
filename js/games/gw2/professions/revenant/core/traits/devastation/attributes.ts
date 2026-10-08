import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeBoonStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

// Reconcile build-time Revenant attributes with live legend, upkeep, and trait
// state without double-applying static bonuses.
export function modifyCoreAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (hasTrait(context, TRAIT.NOTORIETY)) {
    // Notoriety converts only the player's configured and live Might, capped at 25 like the shared query.
    const might = activeBoonStacks(context, 'might');
    const notorietyProfile = requireBalanceProfileFromContext(context, TRAIT.NOTORIETY);
    modified.power = (modified.power || 0) + might * balanceProfileNumber(notorietyProfile, 'attributePerStack');
    modified.conditionDamage =
      (modified.conditionDamage || 0) - might * balanceProfileNumber(notorietyProfile, 'attributePerStack');
  }

  return modified;
}
