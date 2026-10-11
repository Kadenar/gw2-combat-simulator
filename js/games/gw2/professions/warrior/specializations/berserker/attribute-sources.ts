import { applyAttributeContributions } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeContext } from '#gw2/platform/builds/types.js';
import { warriorPassiveAttributes } from '#gw2/professions/warrior/core/skills/attribute-passives.js';
import { warriorCoreTraits } from '#gw2/professions/warrior/core/traits/index.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Blood Reaction samples equipment, Core selected traits and ready passives, excluding Might and later grants. */
export function bloodReactionSource(context: Gw2AttributeContext) {
  // Blood Reaction reads ordinary equipment and owner bonuses, excluding Might and later Berserk bonuses.
  const facts = context;
  const seed = attributeSeed(context.config ?? {}, facts.weaponSet);
  const contributions = [...warriorPassiveAttributes(facts)];
  for (const trait of sourceTraits) if (hasTrait(facts, trait.id)) contributions.push(trait.attributes!(facts));
  return applyAttributeContributions(seed.conversionPool, seed.commonTotals, contributions);
}

// Source membership is static; do not scan non-attribute traits or Pinnacle's Might amplification on every read.
const sourceTraits = warriorCoreTraits.filter((trait) => trait.attributes && trait.id !== TRAIT.PINNACLE_OF_STRENGTH);
