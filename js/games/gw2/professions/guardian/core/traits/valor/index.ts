import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Owns Focus Mastery's live tuning and trait behavior. */
export const focusMastery = defineTrait({
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Focus',
      multiplier: { profile: TRAIT.FOCUS_MASTERY, field: 'rechargeMultiplier' }
    }
  ],

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
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const stalwartDefenderProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STALWART_DEFENDER);
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
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
