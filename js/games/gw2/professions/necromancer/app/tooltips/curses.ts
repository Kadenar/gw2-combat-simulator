import {
  outsideScopeTooltip,
  profileFact,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Describe curses tooltips from the selected balance data. */
export const necromancerCursesTooltips = {
  [TRAIT.BARBED_PRECISION]: traitTooltip(
    'Eligible critical hits can inflict bleeding. Your bleeding lasts longer.',
    [
      ['criticalChance', 'Chance on critical hit', tooltipPercent],
      ['conditionDurationMultiplier', 'Bleeding duration', tooltipFactorChange]
    ],
    'on eligible critical hits'
  ),
  [TRAIT.FURIOUS_DEMISE]: traitTooltip('Gain precision. Entering shroud grants fury.', [
    ['attributeBonus', 'Precision']
  ]),
  [TRAIT.TARGET_THE_WEAK]: traitTooltip(
    'Gain condition damage from precision and critical-strike chance for each condition on the target.',
    [
      ['attributeConversion', 'Precision converted to condition damage', tooltipPercent],
      ['criticalChancePerCondition', 'Critical chance per target condition', tooltipPercent],
      // The selected profile exposes its condition cap alongside the per-condition critical chance.
      ['maximumConditions', 'Maximum conditions counted']
    ]
  ),
  [TRAIT.INSIDIOUS_DISRUPTION]: traitTooltip('Applying a control effect inflicts torment.', undefined, 'on control'),
  [TRAIT.PLAGUE_SENDING]: traitTooltip(
    'Entering shroud or using the supported shade trigger arms a transfer of self-applied conditions on the qualifying hit.',
    [['maximumConditions', 'Maximum self-condition applications transferred']]
  ),
  [TRAIT.CHILLING_DARKNESS]: traitTooltip(
    'Applying blind also inflicts chill.',
    [['cooldown', 'Internal cooldown', tooltipSeconds]],
    'on blind'
  ),
  [TRAIT.MASTER_OF_CORRUPTION]: traitTooltip(
    'Corruption skills recharge faster and apply additional self-conditions that can be transferred.',
    (balanceContext, id) => [
      profileFact(balanceContext, id, 'rechargeMultiplier', 'Corruption recharge reduction', (value) =>
        tooltipPercent(1 - value)
      )
    ]
  ),
  [TRAIT.PATH_OF_CORRUPTION]: outsideScopeTooltip,
  [TRAIT.PARASITIC_CONTAGION]: outsideScopeTooltip,
  [TRAIT.WEAKENING_SHROUD]: traitTooltip(
    'Entering shroud strikes and inflicts bleeding and weakness with Lesser Enfeeble.'
  ),
  [TRAIT.TERROR]: traitTooltip("Fear applications also apply the simulator's damaging Fear condition.", [
    ['conditionBaseDamage', 'Base damage'],
    ['conditionDamageScaling', 'Condition damage scaling']
  ]),
  [TRAIT.LINGERING_CURSE]: traitTooltip(
    'Gain condition damage, extend scepter conditions, and replace Feast of Corruption with Devouring Darkness.',
    [
      ['attributeBonus', 'Condition damage'],
      ['durationMultiplier', 'Scepter condition duration', tooltipFactorChange]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
