import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/** Describe arcane tooltips from the selected balance data. */
export const elementalistArcaneTooltips = {
  [TRAIT.ARCANE_PROWESS]: traitTooltip('Changing attunement grants might.'),
  [TRAIT.ELEMENTAL_ATTUNEMENT]: traitTooltip(
    'Changing attunement grants the boon corresponding to the element entered.'
  ),
  [TRAIT.ELEMENTAL_ENCHANTMENT]: traitTooltip('Gain concentration. Attunement and overload recharges are reduced.', [
    ['attributeBonuses.concentration', 'Concentration'],
    ['rechargeMultiplier', 'Recharge', tooltipFactorChange]
  ]),
  [TRAIT.ARCANE_PRECISION]: traitTooltip(
    'Eligible critical hits have a chance to apply the condition corresponding to your primary attunement.',
    [
      ['procChance', 'Chance on critical hit', tooltipPercent],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]
  ),
  [TRAIT.RENEWING_STAMINA]: traitTooltip('Eligible critical hits grant vigor.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.ARCANE_RESTORATION]: outsideScopeTooltip,
  [TRAIT.ARCANE_RESURRECTION]: outsideScopeTooltip,
  [TRAIT.ELEMENTAL_LOCKDOWN]: traitTooltip('Control effects grant the boon corresponding to your primary attunement.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.FINAL_SHIELDING]: outsideScopeTooltip,
  [TRAIT.EVASIVE_ARCANA]: traitSkillTooltip(
    [ID.FLAME_BURST_TRAIT, ID.CLEANSING_WAVE_TRAIT, ID.BLINDING_FLASH_TRAIT, ID.SHOCK_WAVE_TRAIT],
    'Completing a dodge invokes the current attunement skill. Each attunement has an independent recharge. Healing and cleansing are outside simulation scope.'
  ),
  [TRAIT.ARCANE_LIGHTNING]: traitTooltip(
    'Completing an arcane skill grants temporary ferocity and its corresponding extra effect. Arcane Blast blinds the target.',
    [['attributeBonuses.ferocity', 'Ferocity during Arcane Lightning']]
  ),
  [TRAIT.BOUNTIFUL_POWER]: traitTooltip(
    'After enough attunement transitions, gain quickness and a temporary strike-damage bonus.',
    [
      ['threshold', 'Transitions required'],
      fromProfile(TRAIT.BOUNTIFUL_POWER, 'damageIncrease', 'Strike damage during bonus', tooltipPercent)
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
