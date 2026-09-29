import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
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
