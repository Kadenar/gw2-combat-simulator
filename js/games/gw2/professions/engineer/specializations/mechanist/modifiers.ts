import { applyAttributeContributions, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { selectedFirearmsDurationBonuses } from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { engineerCoreTraits } from '#gw2/professions/engineer/core/traits/index.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerMechModifierEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import {
  selectedSignet,
  signetModifierRules
} from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';

/** Recognizes native and replayed events that belong to the jade mech. */

const mechanistModifierRules: readonly Gw2ModifierRule[] = Object.freeze([...signetModifierRules]);

/** Replaces player attributes with the mech's inherited attribute set for mech-owned events. */
export const mechanistAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!engineerMechModifierEvent(context)) return [];
  const mightStacks = activeBoonStacks(context, 'might');
  // Mech inheritance evaluates ordinary owner declarations with player boons absent.
  const facts = attributeContext(
    {
      ...context,
      query: undefined,
      timeline: undefined,
      runtime: undefined,
      config: {
        ...context.config,
        startingWeaponSet: context.runtime?.activeWeaponSet ?? context.config?.startingWeaponSet,
        boons: {}
      }
    },
    { catalog: (context.catalog ?? context.profession?.catalog)!, modifierRulesById: new Map() }
  );
  const inheritedSource = applyAttributeContributions(
    facts,
    attributeSeed(context.config ?? {}, context.runtime?.activeWeaponSet).commonTotals,
    (input) =>
      engineerCoreTraits.flatMap((trait) =>
        hasTrait(input, trait.id) && trait.attributes ? [trait.attributes(input)] : []
      )
  );
  const mech = engineerMechAttributes(context.config ?? {}, inheritedSource, context);
  if (selectedSignet(context, ID.SHIFT_SIGNET)) {
    mech.power += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
    mech.conditionDamage += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
  }

  // The independent mech receives only the Firearms durations assigned to its actor.
  const conditionDurationBonuses = selectedFirearmsDurationBonuses(context);

  return [{ transforms: [{ kind: 'project', replace: true, attributes: { ...mech, conditionDurationBonuses } }] }];
};

export const mechanistModifiers = Object.freeze({
  modifierRules: mechanistModifierRules
});
