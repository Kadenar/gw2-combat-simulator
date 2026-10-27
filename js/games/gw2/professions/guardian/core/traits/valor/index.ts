import { WEAPON } from '#gw2/platform/constants.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Owns Focus Mastery's live tuning and trait behavior. */
export const focusMastery = defineTrait({
  name: 'Focus Mastery',
  id: TRAIT.FOCUS_MASTERY,
  balance: {
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === WEAPON.FOCUS,
      multiplier: { profile: TRAIT.FOCUS_MASTERY, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Stalwart Defender's live tuning and trait behavior. */
export const stalwartDefender = defineTrait({
  name: 'Stalwart Defender',
  id: TRAIT.STALWART_DEFENDER,
  balance: { attributeBonus: 240 },
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    const offHand = weapons[1] || '';
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Toughness',
          amount: balanceNumberFromContext(profileContext, TRAIT.STALWART_DEFENDER, 'attributeBonus'),
          feedsConversions: 'none',
          enabled: offHand === WEAPON.SHIELD
        }
      ]
    };
  }
});
