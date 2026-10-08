import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

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

/** Focus recharge retains the selected live multiplier before the final virtue adjustment. */
export const focusMasteryRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: TRAIT.FOCUS_MASTERY,
    when: (_runtime, skill) => skill.weapon === 'Focus',
    multiplier: { profile: TRAIT.FOCUS_MASTERY, field: 'rechargeMultiplier' }
  }
]);
