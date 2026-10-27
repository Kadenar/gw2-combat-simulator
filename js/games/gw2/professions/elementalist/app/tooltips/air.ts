import {
  fromProfile,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Describe air tooltips from the selected balance data. */
export const elementalistAirTooltips = {
  [TRAIT.ZEPHYRS_SPEED]: traitTooltip('Gain personal critical-strike chance.', [
    ['criticalChance', 'Critical chance', tooltipPercent]
  ]),
  [TRAIT.ELECTRIC_DISCHARGE]: traitTooltip(
    'Entering Air in combat, or beginning an Air overload, strikes the target and inflicts vulnerability. Electric Discharge has increased critical damage.',
    [['criticalDamage', 'Electric Discharge critical damage', tooltipFactorChange]]
  ),
  [TRAIT.AEROMANCERS_TRAINING]: traitTooltip(
    'Gain ferocity and an additional equal ferocity bonus while primarily attuned to Air. Air-attuned skills recharge faster.',
    [
      ['attributeBonuses.ferocity', 'Ferocity per bonus'],
      ['rechargeMultiplier', 'Air skill recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.ZEPHYRS_BOON]: traitTooltip('Gaining an aura grants fury and swiftness.'),
  [TRAIT.ONE_WITH_AIR]: traitTooltip('Entering Air grants superspeed.'),
  [TRAIT.FEROCIOUS_WINDS]: traitTooltip('Gain ferocity from eligible precision.', [
    ['attributeConversion', 'Precision converted to ferocity', tooltipPercent]
  ]),
  [TRAIT.INSCRIPTION]: traitTooltip(
    'Completing a glyph grants the boon corresponding to your primary attunement. Entering Air separately grants resistance.'
  ),
  [TRAIT.RAGING_STORM]: traitTooltip('Eligible critical hits grant fury. Gain ferocity while fury is active.', [
    ['internalCooldown', 'Fury cooldown', tooltipSeconds],
    ['attributeBonuses.ferocity', 'Ferocity with fury']
  ]),
  [TRAIT.STORMSOUL]: traitTooltip('Your strikes deal increased damage.', [
    fromProfile(TRAIT.STORMSOUL, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
  ]),
  [TRAIT.BOLT_TO_THE_HEART]: traitTooltip(
    'Your strikes deal increased damage against targets at or below half health.',
    [fromProfile(TRAIT.BOLT_TO_THE_HEART, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.FRESH_AIR]: traitTooltip(
    'Eligible critical hits while outside Air recharge Air attunement and Overload Air. Newly entering Air grants temporary ferocity.',
    [['attributeBonuses.ferocity', 'Ferocity during Fresh Air']]
  ),
  [TRAIT.LIGHTNING_ROD]: traitTooltip('Qualifying control effects trigger a strike and inflict weakness.')
} satisfies NonNullable<ProfessionTooltips['traits']>;
