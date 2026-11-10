import {
  fromProfile,
  outsideScopeTooltip,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe acrobatics tooltips from the selected balance data. */
export const thiefAcrobaticsTooltips = {
  [TRAIT.FLUID_STRIKES]: traitTooltip('Completing a movement skill temporarily increases strike damage.', [
    fromProfile(TRAIT.FLUID_STRIKES, 'damageIncrease', 'Strike damage', tooltipPercent),
    ['duration', 'Bonus duration', tooltipSeconds]
  ]),
  [TRAIT.PAIN_RESPONSE]: outsideScopeTooltip,
  [TRAIT.SWINDLERS_EQUILIBRIUM]: traitTooltip('Gain power and additional power while wielding a sword.', [
    ['attributeBonuses.power', 'Power'],
    ['conditionalAttributeBonuses.power', 'Total power while wielding a sword']
  ]),
  [TRAIT.UPPER_HAND]: traitTooltip('Completing a dodge restores initiative.', [
    ['resourceGain', 'Initiative restored'],
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),

  [TRAIT.DEFT_INITIATION]: traitTooltip(
    'Combat entry arms your next direct strike. Completing movement or a shadowstep rearms it once. Might, Vulnerability, and cooldown values are unknown; no bonus is applied until confirmed.',
    [['internalCooldown', 'Pending internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.FELINE_GRACE]: traitTooltip(
    'Movement or shadowsteps grant Swiftness. Duration and cooldown are pending, so no Swiftness is granted yet. Improved movement speed is outside scope.',
    [['internalCooldown', 'Pending internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.OPPORTUNE_OPENING]: traitTooltip(
    'Deft Initiation inflicts cripple. Damage increases against movement-impaired targets. Percentage, stacking, and condition-damage coverage remain unknown. No damage bonus is applied yet.',
    [['damageIncrease', 'Pending strike damage', tooltipPercent]]
  ),
  [TRAIT.ENDURANCE_TRAINING]: traitTooltip(
    'Successful evades grant vigor. Incoming attacks and successful evades are outside simulation scope.'
  ),
  [TRAIT.ASSASSINS_REWARD]: traitTooltip(
    'Deft Initiation heals you. Healing is outside simulation scope; player health stays full.'
  ),
  [TRAIT.HARD_TO_CATCH]: traitTooltip(
    'Steal or a replacement grants Resistance. Its duration is pending, so no Resistance is granted yet. Defensive benefits are outside scope.'
  ),
  [TRAIT.SHARP_INITIATION]: traitTooltip(
    'Deft Initiation deals an extra strike. Coefficient, strength profile, critical-hit eligibility, and cooldown rules are unknown; no bonus is applied until confirmed.'
  ),
  [TRAIT.DONT_STOP]: traitTooltip(
    'Each actual self-swiftness application restores capped endurance. Amount and cooldown remain unknown. No endurance is granted until confirmed. Player condition removal is outside scope.',
    [
      ['resourceGain', 'Pending endurance'],
      ['internalCooldown', 'Pending internal cooldown', tooltipSeconds]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
