import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Owns Focus Mastery's live tuning and trait behavior. */
export const focusMastery = defineTrait({
  id: TRAIT.FOCUS_MASTERY,
  name: 'Focus Mastery',
  balance: {
    rechargeMultiplier: 0.8
  }
});

/** Owns Stalwart Defender's live tuning and trait behavior. */
export const stalwartDefender = defineTrait({
  id: TRAIT.STALWART_DEFENDER,
  name: 'Stalwart Defender',
  balance: { attributeBonus: 240 },
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const stalwartDefenderProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STALWART_DEFENDER);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const offHand = weapons[1] || '';
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Toughness',
          amount: balanceProfileNumber(stalwartDefenderProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: offHand === 'Shield'
        }
      ]
    };
  }
});
