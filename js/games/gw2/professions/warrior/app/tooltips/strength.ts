import {
  fromProfile,
  outsideScopeTooltip,
  tooltipDecimal,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe strength tooltips from the selected balance data. */
export const warriorStrengthTooltips = {
  [TRAIT.RECKLESS_DODGE]: traitTooltip('Completing a dodge strikes the target and grants might.'),
  [TRAIT.BUILDING_MOMENTUM]: traitTooltip('The first qualifying burst hit restores endurance.', [
    ['resourceGain', 'Endurance gained']
  ]),
  [TRAIT.PINNACLE_OF_STRENGTH]: traitTooltip('Might grants additional power. Gain critical-strike chance.', [
    ['attributePerStack', 'Power per might stack'],
    ['criticalChance', 'Critical chance', tooltipPercent]
  ]),
  [TRAIT.BRAVE_STRIDE]: traitTooltip('Completing a movement skill grants adrenaline and stability.', [
    ['resourceGain', 'Adrenaline gained']
  ]),
  [TRAIT.RESTORATIVE_STRENGTH]: traitTooltip('Using a healing skill grants might and resistance to yourself.'),
  [TRAIT.PEAK_PERFORMANCE]: traitTooltip(
    'Deal increased strike damage. Physical skills temporarily grant an additional bonus.',
    [
      fromProfile(TRAIT.PEAK_PERFORMANCE, 'baseBonus', 'Strike damage', tooltipPercent),
      fromProfile(
        TRAIT.PEAK_PERFORMANCE,
        'activeBonus',
        'Additional strike damage after a physical skill',
        tooltipPercent
      )
    ]
  ),
  [TRAIT.BODY_BLOW]: traitTooltip('Player hard-control effects inflict weakness and vulnerability.'),
  [TRAIT.FORCEFUL_GREATSWORD]: traitTooltip(
    'Gain power and additional power while wielding a greatsword. Critical hits can grant might; the chance doubles with a greatsword.',
    [
      ['attributeBonuses.power', 'Power'],
      ['conditionalAttributeBonuses.power', 'Additional power with a greatsword'],
      ['procChance', 'Base might chance on critical hit', tooltipPercent]
    ]
  ),
  [TRAIT.GREAT_FORTITUDE]: traitTooltip(
    'Gain vitality and ferocity from eligible power. The power gained during Berserk also contributes.',
    [['attributeConversion', 'Power converted to each attribute', tooltipPercent]]
  ),
  [TRAIT.BERSERKERS_POWER]: traitTooltip(
    'The first qualifying burst hit grants damage-bonus stacks according to the resource tier spent.',
    [
      ['damageIncreasePerStack', 'Strike damage per stack', tooltipPercent],
      ['maximumStacks', 'Maximum stacks', tooltipDecimal]
    ]
  ),
  [TRAIT.MIGHT_MAKES_RIGHT]: outsideScopeTooltip,
  [TRAIT.AGGRESSIVE_ONSLAUGHT]: traitTooltip('Applying a player control effect grants quickness.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
