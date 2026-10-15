import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe firearms tooltips from the selected balance data. */
export const engineerFirearmsTooltips = {
  [TRAIT.SERRATED_STEEL]: traitTooltip(
    'Eligible critical hits can inflict bleeding. Bleeding lasts longer; the mech maintains its own critical-proc progress.',
    [
      ['procChance', 'Chance on critical hit', tooltipPercent],
      ['durationMultiplier', 'Bleeding duration', tooltipPercent]
    ]
  ),
  [TRAIT.HEMATIC_FOCUS]: traitTooltip(
    'Player-owned bleeding applications grant fury. Fury grants additional player critical-strike chance.',
    [
      ['internalCooldown', 'Fury cooldown', tooltipSeconds],
      ['criticalChance', 'Additional critical chance with fury', tooltipPercent]
    ]
  ),
  [TRAIT.MODIFIED_AMMUNITION]: traitTooltip(
    'Player-owned strikes deal increased damage for each different condition on the target.',
    [
      fromProfile(
        TRAIT.MODIFIED_AMMUNITION,
        'damagePerCondition',
        'Strike damage per target condition',
        tooltipPercent
      ),
      fromProfile(TRAIT.MODIFIED_AMMUNITION, 'maximumConditions', 'Maximum conditions counted', tooltipDecimal)
    ]
  ),
  [TRAIT.CHEMICAL_ROUNDS]: traitTooltip('Gain condition damage. Conditions inflicted by pistol skills last longer.', [
    ['attributeBonus', 'Condition damage'],
    [
      'conditionDurationMultiplier',
      'Pistol condition duration',
      // Present the duration increase as a rounded percentage instead of the internal multiplier.
      (value) => tooltipPercent(Math.round((value - 1) * 100) / 100)
    ]
  ]),
  [TRAIT.SANGUINE_ARRAY]: traitTooltip('Player-owned bleeding applications grant might.'),
  [TRAIT.HIGH_CALIBER]: traitTooltip(
    "Gain player critical-strike chance within the simulator's fixed positioning assumptions.",
    [['criticalChance', 'Critical chance', tooltipPercent]]
  ),
  [TRAIT.JUGGERNAUT]: outsideScopeTooltip,
  [TRAIT.THERMAL_VISION]: traitTooltip(
    'Gain expertise. Player-owned burning applications temporarily increase condition damage.',
    [
      ['attributeBonus', 'Expertise'],
      fromProfile(TRAIT.THERMAL_VISION, 'conditionDamageIncrease', 'Condition damage during the bonus', tooltipPercent)
    ]
  ),
  [TRAIT.NO_SCOPE]: traitTooltip('Eligible critical hits grant fury. Gain ferocity while you have fury.', [
    ['attributeBonus', 'Ferocity with fury'],
    ['internalCooldown', 'Fury cooldown', tooltipSeconds]
  ]),
  [TRAIT.HEAVY_METAL]: traitTooltip(
    'Your critical-strike chance and critical damage are increased against foes that are below the health threshold.',
    (balanceContext) => {
      // Pair each target-health threshold with its bonuses so each row explains when they apply.
      const profile = tooltipProfile(balanceContext, TRAIT.HEAVY_METAL);
      return (['upper', 'middle', 'lower'] as const).map((tier) => {
        const threshold = tooltipDecimal(tooltipNumber(profile, `${tier}Threshold`) * 100);
        const bonus = tooltipDecimal(tooltipNumber(profile, `${tier}Bonus`) * 100);
        return {
          name: `Increase below ${threshold}%`,
          detail: `${bonus}%`,
          icon: MODIFIER_EFFECT_ICONS.Target
        };
      });
    }
  ),
  [TRAIT.SHARPSHOOTER]: traitTooltip(
    'Your bleeding damage scales with Power instead of Condition Damage. This affects only bleeding you inflict.',
    // Show the replacement attribute as a share of Power, without a misleading bonus sign or repeating decimals.
    [
      [
        'coefficientMultiplier',
        'Condition Damage for bleeding',
        (value) => `${Number((value * 100).toFixed(2))}% of Power`
      ]
    ]
  ),
  [TRAIT.INCENDIARY_POWDER]: traitTooltip(
    'Eligible critical hits inflict burning. Burning lasts longer; the mech maintains its own proc cooldown.',
    [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['durationMultiplier', 'Burning duration', tooltipPercent]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
