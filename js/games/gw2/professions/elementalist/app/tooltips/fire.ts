import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { percentagePoints } from '#gw2/professions/elementalist/app/tooltips/shared.js';
import { FLAME_EXPULSION_DELAY_SECONDS } from '#gw2/professions/elementalist/core/traits/fire/attunement-transition.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Describe fire tooltips from the selected balance data. */
export const elementalistFireTooltips = {
  [TRAIT.EMPOWERING_FLAME]: traitTooltip('Gain power while primarily attuned to Fire.', [
    ['attributeBonuses.power', 'Power in Fire']
  ]),
  [TRAIT.SUNSPOT]: traitTooltip(
    'Entering Fire in combat, or beginning a Fire overload, grants Fire Aura and triggers a strike that cannot critically strike.'
  ),
  [TRAIT.PYROMANCERS_TRAINING]: traitTooltip(
    'Fire-attuned skills recharge faster. Your strikes deal increased damage against burning targets.',
    [
      ['rechargeMultiplier', 'Fire skill recharge', tooltipFactorChange],
      fromProfile(
        TRAIT.PYROMANCERS_TRAINING,
        'damageMultiplier',
        'Strike damage against burning targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.BURNING_PRECISION]: traitTooltip(
    'Eligible critical hits have a chance to burn the target. Burning lasts longer.',
    [
      ['procChance', 'Chance on critical hit', tooltipPercent],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['durationMultiplier', 'Burning duration', percentagePoints]
    ]
  ),
  [TRAIT.CONJURER]: traitTooltip('Equipping a conjured weapon grants Fire Aura.'),
  [TRAIT.BURNING_FIRE]: outsideScopeTooltip,
  [TRAIT.BURNING_RAGE]: traitTooltip('Gain condition damage. Sunspot also burns the target.', [
    ['attributeBonuses.conditionDamage', 'Condition damage']
  ]),
  [TRAIT.SMOTHERING_AURAS]: traitTooltip('Auras last longer.', [
    ['durationMultiplier', 'Aura duration', tooltipFactorChange]
  ]),
  [TRAIT.POWER_OVERWHELMING]: traitTooltip(
    'Gain power while you have enough might. Fire attunement uses the larger bonus instead.',
    [
      ['minimumStacks', 'Might stacks required'],
      ['attributeBonuses.power', 'Power outside Fire'],
      ['conditionalAttributeBonuses.power', 'Power in Fire']
    ]
  ),
  [TRAIT.PERSISTING_FLAMES]: traitTooltip(
    'Eligible fire-field hits grant temporary strike-damage stacks. Weapon fire fields last longer and keep pulsing their damage and conditions.',
    [
      fromProfile(TRAIT.PERSISTING_FLAMES, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
      ['maximumStacks', 'Maximum stacks', tooltipDecimal],
      ['duration', 'Stack duration', tooltipSeconds],
      ['durationPerTier', 'Additional weapon field duration', tooltipSeconds]
    ]
  ),
  [TRAIT.PYROMANCERS_PUISSANCE]: traitTooltip(
    'Using skills in Fire grants might. Leaving Fire or completing Overload Fire triggers Flame Expulsion: snapshot your capped might, scale its strike and burning, and grant that many might stacks to other allies.',
    // The scheduler owns delivery timing; the selected profile still supplies might scaling.
    (context, id) => [
      { name: 'Flame Expulsion delay', detail: tooltipSeconds(FLAME_EXPULSION_DELAY_SECONDS) },
      profileFact(context, id, 'maximumStacks', 'Maximum might counted'),
      profileFact(context, id, 'damageIncreasePerStack', 'Additional strike coefficient per might'),
      profileFact(context, id, 'durationPerTier', 'Additional burning duration per might', tooltipSeconds)
    ],
    'listed Flame Expulsion damage is before might scaling'
  ),
  [TRAIT.INFERNO]: traitTooltip(
    'Burning scales with power instead of condition damage, retaining the shared burning base damage.',
    [
      // Display the Power conversion using combat's canonical Burning scaling.
      [
        'coefficientMultiplier',
        'Burning damage per second per power',
        (value) => tooltipDecimal(value * CONDITION_FORMULAS.Burning.scaling)
      ]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
