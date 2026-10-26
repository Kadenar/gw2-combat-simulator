import { skillAttributeEffects } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistPassiveAttributes } from '#gw2/professions/elementalist/core/skills/attribute-passives.js';

/** Conjure grants use the currently held weapon so dropping it also updates lingering attacks. */
export const elementalistSkillAttributes: Gw2AttributeContributionCalculator = (context) => {
  const weapon = wieldedConjure(context);
  // Holding the bundle is the eligibility rule; the conjure skill owns which attributes it grants.
  const skillId =
    weapon === 'Fiery Greatsword'
      ? ID.CONJURE_FIERY_GREATSWORD
      : weapon === 'Lightning Hammer'
        ? ID.CONJURE_LIGHTNING_HAMMER
        : null;
  const effects = skillId ? skillAttributeEffects(requireSkillFromContext(context.balanceContext, skillId)) : [];

  return [...elementalistPassiveAttributes(context), { attributeEffects: effects }];
};
