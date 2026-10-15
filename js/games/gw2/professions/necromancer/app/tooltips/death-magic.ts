import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { lifeForce } from '#gw2/professions/necromancer/app/tooltips/shared.js';

/** Describe death magic tooltips from the selected balance data. */
export const necromancerDeathMagicTooltips = {
  [TRAIT.ARMORED_SHROUD]: traitTooltip('Entering shroud grants carapace.', [
    ['resourceGain', 'Carapace on shroud entry'],
    ['duration', 'Carapace duration', tooltipSeconds]
  ]),
  [TRAIT.SOUL_COMPREHENSION]: traitTooltip(
    'Entering shroud generates life force for each carapace stack already active before entry grants.',
    [
      ['lifeForcePerStack', 'Life force per current carapace stack', lifeForce],
      ['maximumStacks', 'Maximum carapace stacks counted']
    ]
  ),
  [TRAIT.BEYOND_THE_VEIL]: outsideScopeTooltip,
  [TRAIT.FLESH_OF_THE_MASTER]: traitTooltip('Your minions grant carapace stacks.', [
    ['resourceGain', 'Carapace per minion'],
    ['maximumStacks', 'Maximum carapace']
  ]),
  [TRAIT.PUTRID_DEFENSE]: traitTooltip('Poison deals increased damage.', [
    fromProfile(TRAIT.PUTRID_DEFENSE, 'conditionDamageMultiplier', 'Poison damage', tooltipFactorChange)
  ]),
  [TRAIT.SHROUDED_REMOVAL]: traitTooltip(
    'Entering shroud removes active self-condition applications. Successful removal grants carapace.',
    [
      ['resourceGain', 'Carapace per successful removal'],
      ['duration', 'Carapace duration', tooltipSeconds],
      ['maximumConditions', 'Maximum self-condition applications removed']
    ]
  ),
  [TRAIT.NECROMANTIC_CORRUPTION]: traitTooltip('Your minions deal increased strike damage.', [
    ['damageMultiplier', 'Minion strike damage', tooltipFactorChange]
  ]),
  [TRAIT.DARK_DEFENSE]: traitTooltip('Using a healing skill grants carapace and protection.', [
    ['resourceGain', 'Carapace'],
    ['duration', 'Carapace duration', tooltipSeconds],
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.DEADLY_STRENGTH]: traitTooltip('Carapace grants power and condition damage.', [
    ['attributePerStack', 'Power and condition damage per carapace']
  ]),
  [TRAIT.DEATH_NOVA]: outsideScopeTooltip,
  [TRAIT.CORRUPTERS_FERVOR]: traitTooltip('Qualifying non-summon condition applications grant carapace.', [
    ['resourceGain', 'Carapace per qualifying condition application'],
    ['duration', 'Carapace duration', tooltipSeconds]
  ]),
  [TRAIT.UNHOLY_SANCTUARY]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
