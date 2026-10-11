import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { elementalistPassiveAttributes } from '#gw2/professions/elementalist/core/skills/attribute-passives.js';

/** Conjure grants use the currently held weapon so dropping it also updates lingering attacks. */
export const elementalistSkillAttributes: Gw2AttributeContributionCalculator = (context) => {
  const weapon = wieldedConjure(context);
  const profileId =
    weapon === 'Fiery Greatsword'
      ? PROFILE.fieryGreatsword
      : weapon === 'Lightning Hammer'
        ? PROFILE.lightningHammer
        : null;
  const effects = [];
  if (profileId) {
    const profile = requireBalanceProfileFromContext(context, profileId);
    effects.push(
      {
        kind: 'flat' as const,
        to: weapon === 'Fiery Greatsword' ? 'Power' : 'Precision',
        amount: balanceProfileNumber(profile, 'weaponAttributeBonus'),
        feedsConversions: false
      },
      {
        kind: 'flat' as const,
        to: weapon === 'Fiery Greatsword' ? 'Condition Damage' : 'Ferocity',
        amount: balanceProfileNumber(profile, 'attributeBonus'),
        feedsConversions: false
      }
    );
  }

  return [...elementalistPassiveAttributes(context), { attributeEffects: effects }];
};
