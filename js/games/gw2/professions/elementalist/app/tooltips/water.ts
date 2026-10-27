import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Describe water tooltips from the selected balance data. */
export const elementalistWaterTooltips = {
  [TRAIT.SOOTHING_MIST]: outsideScopeTooltip,
  [TRAIT.HEALING_RIPPLE]: outsideScopeTooltip,
  [TRAIT.AQUAMANCERS_TRAINING]: traitTooltip('Water-attuned skills recharge faster.', [
    ['rechargeMultiplier', 'Water skill recharge', tooltipFactorChange]
  ]),
  [TRAIT.SOOTHING_ICE]: traitTooltip('Completing a healing skill grants Frost Aura and regeneration.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.PIERCING_SHARDS]: traitTooltip(
    'Your strikes deal increased damage against vulnerable targets, with a larger bonus while primarily attuned to Water.',
    [
      fromProfile(TRAIT.PIERCING_SHARDS, 'otherFactor', 'Strike damage', tooltipFactorChange),
      fromProfile(TRAIT.PIERCING_SHARDS, 'waterFactor', 'Strike damage in Water', tooltipFactorChange)
    ]
  ),
  [TRAIT.STOP_DROP_AND_ROLL]: outsideScopeTooltip,
  [TRAIT.SOOTHING_DISRUPTION]: outsideScopeTooltip,
  [TRAIT.CLEANSING_WAVE]: outsideScopeTooltip,
  [TRAIT.FLOW_LIKE_WATER]: traitTooltip(
    'Your strikes deal increased damage. The full-health condition applies throughout combat.',
    [fromProfile(TRAIT.FLOW_LIKE_WATER, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.CLEANSING_WATER]: outsideScopeTooltip,
  [TRAIT.POWERFUL_AURA]: outsideScopeTooltip,
  [TRAIT.SOOTHING_POWER]: traitTooltip('Gain vitality. Healing is outside combat simulation scope.', [
    ['attributeBonuses.vitality', 'Vitality']
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
