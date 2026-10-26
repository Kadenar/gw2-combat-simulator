import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

import { passiveSkillAttributes } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const guardianPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      ...passiveSkillAttributes(
        context,
        ID.BANE_SIGNET,
        () => guardianSignetPassiveActive(context, ID.BANE_SIGNET),
        perfectInscriptionsMultiplier(context)
      ),
      ...passiveSkillAttributes(
        context,
        ID.SIGNET_OF_WRATH,
        () => guardianSignetPassiveActive(context, ID.SIGNET_OF_WRATH),
        perfectInscriptionsMultiplier(context)
      )
    ]
  }
];

/** Signet passives keep their ordinary cooldown rule unless Perfect Inscriptions retains them. */
function guardianSignetPassiveActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS) || !context.timeline?.skillOnCooldownAt(skillId, context.time);
}

/** Build and live signet grants read the same selected multiplier, including disabled-trait previews. */
function perfectInscriptionsMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS)
    ? balanceNumberFromContext(context, TRAIT.PERFECT_INSCRIPTIONS, 'attributeMultiplier')
    : 1;
}
