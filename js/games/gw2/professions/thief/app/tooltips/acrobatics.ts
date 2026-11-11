// Describe confirmed Acrobatics values and distinguish successful-evade effects from simulated dodges.
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
  [TRAIT.SWINDLERS_EQUILIBRIUM]: traitTooltip(
    'Gain power and additional power while wielding a sword. Successful evades while wielding a sword reduce Steal recharge by 2 seconds, with a 1-second cooldown. Incoming attacks are outside scope.',
    [
      ['attributeBonuses.power', 'Power'],
      ['conditionalAttributeBonuses.power', 'Total power while wielding a sword']
    ]
  ),
  [TRAIT.UPPER_HAND]: traitTooltip(
    'Every completed dodge restores initiative. Successful evades also grant initiative and 6 seconds of Regeneration, but incoming attacks and healing are outside scope.',
    [
      ['resourceGain', 'Initiative restored'],
      ['internalCooldown', 'Successful-evade interval', tooltipSeconds]
    ]
  ),

  [TRAIT.DEFT_INITIATION]: traitTooltip(
    'Combat entry arms your next direct strike to grant Might and inflict Vulnerability. Completing movement or a shadowstep rearms it once.'
  ),
  [TRAIT.FELINE_GRACE]: traitTooltip(
    'Movement or shadowsteps grant Swiftness. The improved 40% movement speed is outside scope.'
  ),
  [TRAIT.OPPORTUNE_OPENING]: traitTooltip(
    'Deft Initiation inflicts Cripple. Strike damage increases against targets with Cripple, Chill, or Immobilize. Condition-damage coverage remains unconfirmed.',
    [['damageIncrease', 'Strike damage', tooltipPercent]]
  ),
  [TRAIT.ENDURANCE_TRAINING]: traitTooltip(
    'Successful evades grant 5 seconds of Vigor. Incoming attacks and successful evades are outside simulation scope.'
  ),
  [TRAIT.ASSASSINS_REWARD]: traitTooltip(
    'Deft Initiation heals you. Healing is outside simulation scope; player health stays full.'
  ),
  [TRAIT.HARD_TO_CATCH]: traitTooltip(
    'Steal or a replacement grants Resistance. Defensive benefits are outside scope.'
  ),
  [TRAIT.SHARP_INITIATION]: traitTooltip(
    'Deft Initiation deals an extra strike. The coefficient is inferred from the supplied tooltip and Power using unequipped strength. Critical hits are currently enabled but remain unconfirmed.'
  ),
  [TRAIT.DONT_STOP]: traitTooltip(
    'Each actual self-swiftness application restores capped endurance. Player condition removal is outside scope.',
    [['resourceGain', 'Endurance restored']]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
