import { applyAttributeContributions, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeContext, Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import { selectedFirearmsDurationBonuses } from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { engineerCoreTraits } from '#gw2/professions/engineer/core/traits/index.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { isEngineerMechEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-queries.js';
import { selectedSignet } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';

// Inheritance only evaluates Core attribute declarations; unrelated traits have no source work.
const sourceTraits = engineerCoreTraits.filter((trait) => trait.attributes);
const inheritedByQuery = new WeakMap<object, Map<number, ReturnType<typeof inheritedMechAttributes>>>();

/** Replaces player attributes with the mech's inherited attribute set for mech-owned events. */
export const mechanistAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!isEngineerMechEvent(context.event)) return [];
  let byWeaponSet = context.query ? inheritedByQuery.get(context.query) : undefined;
  if (context.query && !byWeaponSet) inheritedByQuery.set(context.query, (byWeaponSet = new Map()));
  let base = byWeaponSet?.get(context.weaponSet);
  if (!base) {
    base = inheritedMechAttributes(context);
    byWeaponSet?.set(context.weaponSet, base);
  }

  // Inheritance excludes player boons; copied Might remains live and never mutates the cached base.
  const might = selectedSignet(context, ID.SHIFT_SIGNET)
    ? activeBoonStacks(context, 'might') * MIGHT_ATTRIBUTE_BONUS_PER_STACK
    : 0;
  return [
    {
      transforms: [
        {
          kind: 'project',
          replace: true,
          attributes: {
            ...base,
            power: base.power + might,
            conditionDamage: base.conditionDamage + might
          }
        }
      ]
    }
  ];
};

/** Fixed selection and boon-free Core declarations give each query one inheritance source per weapon set. */
function inheritedMechAttributes(context: Gw2AttributeContext) {
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
    context.balanceContext
  );
  const seed = attributeSeed(context.config ?? {}, context.weaponSet);
  const contributions = [];
  for (const trait of sourceTraits) if (hasTrait(facts, trait.id)) contributions.push(trait.attributes!(facts));
  const inheritedSource = applyAttributeContributions(seed, seed.commonTotals, contributions);
  const mech = engineerMechAttributes(context.config ?? {}, inheritedSource, context);

  // The independent mech receives only the Firearms durations assigned to its actor.
  const conditionDurationBonuses = Object.freeze(selectedFirearmsDurationBonuses(context));

  return Object.freeze({ ...mech, conditionDurationBonuses });
}
