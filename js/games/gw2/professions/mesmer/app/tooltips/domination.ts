import {
  fromProfile,
  outsideScopeTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe domination tooltips from the selected balance data. */
export const mesmerDominationTooltips = {
  [TRAIT.ILLUSION_OF_VULNERABILITY]: outsideScopeTooltip,
  [TRAIT.DAZZLING]: traitTooltip('Landed control effects from you or your summons inflict vulnerability.'),
  [TRAIT.FRAGILITY]: traitTooltip('Your strikes deal increased damage for each vulnerability stack on the target.', [
    fromProfile(TRAIT.FRAGILITY, 'damageIncreasePerStack', 'Strike damage per vulnerability stack', tooltipPercent)
  ]),
  [TRAIT.BOUNTIFUL_BLADES]: traitTooltip(
    'Mirror Blade gains additional target hits. Phantasmal Berserker summons additional phantasms, each with reduced damage.',
    [
      [RECIPIENT.SUMMONS, 'Phantasm count multiplier', (value) => `${tooltipDecimal(value)}×`],
      ['damageMultiplier', 'Damage per phantasm', tooltipFactorChange]
    ],
    'additional Mirror Blade hits'
  ),
  [TRAIT.EMPOWERED_ILLUSIONS]: traitTooltip('Clones and phantasms deal increased strike damage.', [
    fromProfile(TRAIT.EMPOWERED_ILLUSIONS, 'damageMultiplier', 'Illusion strike damage', tooltipFactorChange)
  ]),
  [TRAIT.RENDING_SHATTER]: traitTooltip(
    'Shatter hits inflict vulnerability for each illusion or blade. Instrument hits also inflict vulnerability.'
  ),
  [TRAIT.SHATTERED_CONCENTRATION]: outsideScopeTooltip,
  [TRAIT.EGOTISM]: traitTooltip(
    'Your strikes deal increased damage after the target has lost health. Your own health remains full in combat.',
    [fromProfile(TRAIT.EGOTISM, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.FURIOUS_INTERRUPTION]: outsideScopeTooltip,
  [TRAIT.VICIOUS_EXPRESSION]: traitTooltip(
    'Deal increased strike damage against the boonless simulated target, including illusion strikes.',
    [fromProfile(TRAIT.VICIOUS_EXPRESSION, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.MENTAL_ANGUISH]: traitTooltip(
    'Eligible first-strike shatter packets deal increased damage, with a larger bonus while the target is not activating skills.',
    [
      fromProfile(
        TRAIT.MENTAL_ANGUISH,
        'activatingFactor',
        'Damage while target activates skills',
        tooltipFactorChange
      ),
      fromProfile(TRAIT.MENTAL_ANGUISH, 'idleFactor', 'Damage while target is idle', tooltipFactorChange)
    ]
  ),
  [TRAIT.POWER_BLOCK]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
