import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  fromProfile,
  maximumBonusFact,
  outsideScopeTooltip,
  profileFact,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  type FactSpec,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { lifeForce } from '#gw2/professions/necromancer/app/tooltips/shared.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Carapace facts use the effect's icon regardless of how each trait labels its stacks. */
function carapaceFact(field: string, name: string, format = tooltipDecimal): FactSpec {
  return (context, id) => ({
    ...profileFact(context, id, field, name, format),
    icon: MODIFIER_EFFECT_ICONS["Death's Carapace"]
  });
}

/** Describe death magic tooltips from the selected balance data. */
export const necromancerDeathMagicTooltips = {
  [TRAIT.ARMORED_SHROUD]: traitTooltip('Entering shroud grants carapace.', [
    carapaceFact('resourceGain', 'Carapace on shroud entry'),
    carapaceFact('duration', 'Carapace duration', tooltipSeconds)
  ]),
  [TRAIT.SOUL_COMPREHENSION]: traitTooltip(
    "Entering shroud generates life force for each active carapace stack, including Armored Shroud's entry stacks.",
    [
      carapaceFact('lifeForcePerStack', 'Life force per current carapace stack', lifeForce),
      maximumBonusFact('lifeForcePerStack', 'maximumStacks', 'Maximum life force gained', lifeForce)
    ]
  ),
  [TRAIT.BEYOND_THE_VEIL]: outsideScopeTooltip,
  [TRAIT.FLESH_OF_THE_MASTER]: traitTooltip('Your minions grant carapace stacks.', [
    carapaceFact('resourceGain', 'Carapace per minion'),
    carapaceFact('maximumStacks', 'Maximum carapace')
  ]),
  [TRAIT.PUTRID_DEFENSE]: traitTooltip('Poison deals increased damage.', [
    fromProfile(TRAIT.PUTRID_DEFENSE, 'conditionDamageMultiplier', 'Poison damage', tooltipFactorChange)
  ]),
  [TRAIT.SHROUDED_REMOVAL]: traitTooltip(
    'Entering shroud removes active self-condition applications. Successful removal grants carapace.',
    [
      carapaceFact('resourceGain', 'Carapace per successful removal'),
      carapaceFact('duration', 'Carapace duration', tooltipSeconds),
      ['maximumConditions', 'Maximum self-condition applications removed']
    ]
  ),
  [TRAIT.NECROMANTIC_CORRUPTION]: traitTooltip('Your minions deal increased strike damage.', [
    ['damageMultiplier', 'Minion strike damage', tooltipFactorChange]
  ]),
  [TRAIT.DARK_DEFENSE]: traitTooltip('Using a healing skill grants carapace and protection.', [
    carapaceFact('resourceGain', 'Carapace'),
    carapaceFact('duration', 'Carapace duration', tooltipSeconds),
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.DEADLY_STRENGTH]: traitTooltip('Carapace grants power and condition damage.', [
    carapaceFact('attributePerStack', 'Power and condition damage per carapace'),
    maximumBonusFact(
      'attributePerStack',
      'maximumStacks',
      'Maximum Power and Condition Damage bonus each',
      tooltipDecimal,
      TRAIT.FLESH_OF_THE_MASTER
    )
  ]),
  [TRAIT.DEATH_NOVA]: outsideScopeTooltip,
  [TRAIT.CORRUPTERS_FERVOR]: traitTooltip('Inflicting a condition on a foe grants carapace.', [
    carapaceFact('resourceGain', 'Carapace per condition stack applied'),
    carapaceFact('duration', 'Carapace duration', tooltipSeconds)
  ]),
  [TRAIT.UNHOLY_SANCTUARY]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
