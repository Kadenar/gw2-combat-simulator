import {
  fromProfile,
  outsideScopeTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipNumber,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Describe radiance tooltips from the selected balance data. */
export const guardianRadianceTooltips = {
  // Describe each surviving component's selected duration for Core and every elite specialization.
  [TRAIT.JUSTICE_IS_BLIND]: (context, entity) => {
    const effects = tooltipProfile(context, TRAIT.JUSTICE_IS_BLIND).effects ?? [];
    const blind = effects.find((effect) => effect.type === 'condition' && effect.name === 'Blind');
    const aura = effects.find((effect) => effect.type === 'aura');
    const grants = [
      ...(blind ? [`blinds the target for ${tooltipNumber(blind, 'duration')} seconds`] : []),
      ...(aura ? [`grants you a light aura for ${tooltipNumber(aura, 'duration')} seconds`] : [])
    ];
    return traitTooltip(
      grants.length
        ? `Activating Justice ${grants.join(' and ')}.`
        : 'No simulated effects remain in the selected balance data.'
    )(context, entity);
  },
  [TRAIT.RENEWED_JUSTICE]: outsideScopeTooltip,
  [TRAIT.RADIANT_POWER]: traitTooltip('Gain ferocity and additional critical-strike chance against burning targets.', [
    ['attributeBonuses.ferocity', 'Ferocity', tooltipDecimal],
    ['criticalChance', 'Critical chance against burning targets', tooltipPercent]
  ]),
  [TRAIT.INNER_FIRE]: traitTooltip('Gain fury when your strike hits a target with enough burning stacks.', [
    ['threshold', 'Burning stack threshold'],
    ['internalCooldown', 'Cooldown', tooltipSeconds]
  ]),
  [TRAIT.RIGHT_HAND_STRENGTH]: traitTooltip('Gain precision and additional power with a one-handed main-hand weapon.', [
    ['attributeBonuses.precision', 'Precision', tooltipDecimal],
    ['attributeBonuses.power', 'Power with a one-handed main hand', tooltipDecimal]
  ]),
  [TRAIT.HEALERS_RESOLUTION]: traitTooltip('Committing a healing skill grants resolution.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.WRATH_OF_JUSTICE]: outsideScopeTooltip,
  [TRAIT.RADIANT_FIRE]: traitTooltip(
    "Burning lasts longer. Torch skills recharge faster; Zealot's Flame gains ammunition and its burning has an additional base-duration multiplier.",
    [
      ['conditionDurationBonus', 'Burning duration', tooltipPercent],
      ['rechargeMultiplier', 'Torch recharge duration', tooltipFactorChange],
      ['maximumStacks', "Zealot's Flame ammunition"],
      ['durationMultiplier', "Zealot's Flame base burning duration", tooltipFactorChange]
    ]
  ),
  [TRAIT.RETRIBUTION]: traitTooltip('Deal increased strike damage while you have resolution.', [
    fromProfile(TRAIT.RETRIBUTION, 'damageIncrease', 'Strike damage with resolution', tooltipPercent)
  ]),
  [TRAIT.AMPLIFIED_WRATH]: traitTooltip('Burning deals increased damage. Justice passive burning also lasts longer.', [
    fromProfile(TRAIT.AMPLIFIED_WRATH, 'conditionDamageMultiplier', 'Burning damage', tooltipFactorChange),
    ['durationMultiplier', 'Justice passive burning duration', tooltipFactorChange]
  ]),
  [TRAIT.PERFECT_INSCRIPTIONS]: traitTooltip(
    'Supported signet passives become stronger and remain active during recharge.',
    [
      ['attributeMultiplier', 'Bane Signet passive bonus', tooltipFactorChange],
      ['attributeMultiplier', 'Signet of Wrath passive bonus', tooltipFactorChange]
    ]
  ),
  [TRAIT.RIGHTEOUS_INSTINCTS]: traitTooltip(
    'Resolution grants critical-strike chance and periodically grants might while active.',
    [
      ['criticalChance', 'Critical chance with resolution', tooltipPercent],
      ['pulseInterval', 'Might interval', tooltipSeconds]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
