import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Owns Energy Amplifier tuning and behavior at its established runtime and build boundaries. */
export const energyAmplifier = defineTrait({
  id: TRAIT.ENERGY_AMPLIFIER,
  name: 'Energy Amplifier',
  balance: {
    attributeBonus: 250
  },
  attributes: ({ balanceContext: profileContext, loadout }) => {
    const engineerBuild = loadout;
    const energyAmplifierProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ENERGY_AMPLIFIER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Healing Power',
          amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions.regeneration !== false
        }
      ]
    };
  }
});
