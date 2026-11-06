import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { ownerAttributeBonusNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Owns Energy Amplifier tuning and behavior at its established runtime and build boundaries. */
export const energyAmplifier = defineTrait({
  id: TRAIT.ENERGY_AMPLIFIER,
  balance: {
    attributeBonuses: { power: 250, healingPower: 250 }
  },
  attributes: ({ balanceContext: profileContext, loadout }) => {
    const engineerBuild = loadout;
    const energyAmplifierProfile = requireBalanceProfile(profileContext.catalog, TRAIT.ENERGY_AMPLIFIER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: ownerAttributeBonusNumber(energyAmplifierProfile, 'power'),
          feedsConversions: 'none',
          enabled: engineerBuild.assumptions.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Healing Power',
          amount: ownerAttributeBonusNumber(energyAmplifierProfile, 'healingPower'),
          feedsConversions: 'none',
          enabled: engineerBuild.assumptions.regeneration !== false
        }
      ]
    };
  }
});
