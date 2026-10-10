import { applyAttributeContributions, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { warriorPassiveAttributes } from '#gw2/professions/warrior/core/skills/attribute-passives.js';
import { warriorCoreTraits } from '#gw2/professions/warrior/core/traits/index.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Blood Reaction samples equipment, Core selected traits and ready passives, excluding Might and later grants. */
export function bloodReactionSource(context: Gw2ModifierContext) {
  // Blood Reaction reads ordinary equipment and owner bonuses, excluding Might and later Berserk bonuses.
  const facts = attributeContext(context, {
    catalog: (context.catalog ?? context.profession?.catalog)!,
    modifierRulesById: new Map()
  });
  return applyAttributeContributions(
    facts,
    attributeSeed(context.config ?? {}, facts.weaponSet).commonTotals,
    (input) => [
      ...warriorPassiveAttributes(input),
      ...warriorCoreTraits.flatMap((trait) =>
        // Pinnacle's Might amplification is a live grant, excluded from Blood Reaction's owner source.
        trait.id !== TRAIT.PINNACLE_OF_STRENGTH && hasTrait(input, trait.id) && trait.attributes
          ? [trait.attributes(input)]
          : []
      )
    ]
  );
}
