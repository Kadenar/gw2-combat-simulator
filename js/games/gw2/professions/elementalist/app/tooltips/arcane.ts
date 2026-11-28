import {
  fromProfile,
  invokedSkillFacts,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipPercentValue,
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
      ['procChance', 'Chance on critical hit', tooltipPercentValue],
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
  // Each attunement has its own dodge skill and recharge.
  [TRAIT.EVASIVE_ARCANA]: (context) => ({
    description: 'Finishing a dodge casts a skill based on your attunement. Each skill recharges independently.',
    facts: [],
    factTabs: (
      [
        ['Fire', ID.FLAME_BURST_TRAIT],
        ['Water', ID.CLEANSING_WAVE_TRAIT],
        ['Air', ID.BLINDING_FLASH_TRAIT],
        ['Earth', ID.SHOCK_WAVE_TRAIT]
      ] as const
    ).map(([label, id]) => ({
      label,
      facts: [
        ...invokedSkillFacts(context, id),
        ...(id === ID.CLEANSING_WAVE_TRAIT
          ? [{ name: 'Cleansing Wave', detail: 'Healing and condition removal are outside simulation scope.' }]
          : [])
      ]
    }))
  }),
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
