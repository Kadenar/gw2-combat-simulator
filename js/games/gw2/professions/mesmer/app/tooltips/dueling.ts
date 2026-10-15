import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  tooltipDecimal,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe dueling tooltips from the selected balance data. */
export const mesmerDuelingTooltips = {
  [TRAIT.CRITICAL_INFUSION]: traitTooltip(
    'Your critical hits grant vigor. Critical hits from clones and phantasms do not trigger this trait.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.SHARPER_IMAGES]: traitTooltip('Critical strikes from clones and phantasms inflict bleeding.'),
  [TRAIT.MASTER_FENCER]: traitTooltip(
    'Your eligible critical hits grant fury to yourself and nearby allies, with different durations.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.PHANTASMAL_FURY]: traitTooltip(
    'Phantasms gain critical-strike chance. Virtuoso grants an additional phantasm critical-chance bonus.',
    [
      ['criticalChance', 'Phantasm critical chance', tooltipPercent],
      fromProfile(
        TRAIT.QUIET_INTENSITY,
        'phantasmCriticalChance',
        'Additional phantasm critical chance as Virtuoso',
        tooltipPercent
      )
    ]
  ),
  [TRAIT.MENTAL_GYMNASTICS]: outsideScopeTooltip,
  [TRAIT.DUELISTS_DISCIPLINE]: outsideScopeTooltip,
  [TRAIT.BLINDING_DISSIPATION]: traitTooltip(
    'Eligible shatter hits blind the target. Blindness can trigger Ineptitude.'
  ),
  [TRAIT.WANDERING_MIND]: outsideScopeTooltip,
  [TRAIT.FENCERS_FINESSE]: traitTooltip('Sword hits grant stacking ferocity. Sword skills recharge faster.', [
    ['attributePerStack', 'Ferocity per stack'],
    ['maximumStacks', 'Maximum stacks'],
    ['durationMultiplier', 'Stack duration', tooltipSeconds],
    ['rechargeMultiplier', 'Sword recharge', tooltipFactorChange]
  ]),
  [TRAIT.SUPERIORITY_COMPLEX]: traitTooltip(
    'Your critical strikes deal increased damage. Use the larger bonus against low-health or targets affected by Fear or Taunt; defiance alone does not activate it.',
    [
      ['highHealthFactor', 'Base critical damage', tooltipFactorChange],
      ['lowHealthOrDisabledFactor', 'Enhanced critical damage', tooltipFactorChange],
      ['threshold', 'Target health threshold', (value) => `${tooltipDecimal(value * 100)}%`]
    ]
  ),
  [TRAIT.INEPTITUDE]: traitTooltip(
    'Blindness and qualifying interrupts inflict confusion. Only the interrupt trigger against a defiant target has an internal cooldown.',
    [['internalCooldown', 'Defiant interrupt cooldown', tooltipSeconds]]
  ),
  [TRAIT.DECEPTIVE_EVASION]: traitTooltip('Dodging as Mirage creates a clone.')
} satisfies NonNullable<ProfessionTooltips['traits']>;
