import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerBuild } from '#gw2/professions/engineer/types.js';

/** Owns Energy Amplifier tuning and behavior at its established runtime and build boundaries. */
export const energyAmplifier = defineTrait({
  id: TRAIT.ENERGY_AMPLIFIER,
  name: 'Energy Amplifier',
  balance: {
    attributeBonus: 250
  },
  buildAttributes: (_common, { balanceContext: profileContext, build }) => {
    const engineerBuild = build as EngineerBuild;
    const energyAmplifierProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ENERGY_AMPLIFIER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions?.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Healing Power',
          amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions?.regeneration !== false
        }
      ]
    };
  }
});

/** Applies Energy Amplifier at the live attribute boundary while preserving build provenance. */
export function applyEnergyAmplifierAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (
    hasTrait(context, TRAIT.ENERGY_AMPLIFIER) &&
    activeBoonStacks(context, 'regeneration', 1) > 0 &&
    // only skip if regen is a permanent assumption AND build attributes already account for it
    !(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.regeneration))
  ) {
    const energyAmplifierProfile = requireBalanceProfileFromContext(context, TRAIT.ENERGY_AMPLIFIER);
    const attributeBonus = balanceProfileNumber(energyAmplifierProfile, 'attributeBonus');
    modified.power = (modified.power || 0) + attributeBonus;
    modified.healingPower = (modified.healingPower || 0) + attributeBonus;
  }
}
