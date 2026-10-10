import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { type Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

/** Applies Explosive Temper at the live attribute boundary while preserving build provenance. */
export function applyExplosiveTemperAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
    modified.ferocity =
      (modified.ferocity || 0) +
      activeBuffStacks(context, 'explosive-temper', balanceProfileNumber(explosiveTemperProfile, 'maximumStacks')) *
        balanceProfileNumber(explosiveTemperProfile, 'attributePerStack');
  }
}
