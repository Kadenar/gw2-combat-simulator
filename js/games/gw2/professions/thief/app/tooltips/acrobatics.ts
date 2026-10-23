import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';

/** Describe acrobatics tooltips from the selected balance data. */
export const thiefAcrobaticsTooltips = {
  [TRAIT.EXPEDITIOUS_DODGER]: outsideScopeTooltip,
  [TRAIT.FELINE_GRACE]: outsideScopeTooltip,
  [TRAIT.FLUID_STRIKES]: traitTooltip('Completing a movement skill temporarily increases strike damage.', [
    fromProfile(TRAIT.FLUID_STRIKES, 'damageIncrease', 'Strike damage', tooltipPercent),
    ['duration', 'Bonus duration', tooltipSeconds]
  ]),
  [TRAIT.INSTANT_REFLEXES]: outsideScopeTooltip,
  [TRAIT.PUMPING_UP]: traitTooltip('Dodging grants might to yourself.'),
  [TRAIT.PAIN_RESPONSE]: outsideScopeTooltip,
  [TRAIT.GUARDED_INITIATION]: outsideScopeTooltip,
  [TRAIT.SWINDLERS_EQUILIBRIUM]: traitTooltip('Gain power and additional power while wielding a sword.', [
    ['attributeBonus', 'Power'],
    ['weaponAttributeBonus', 'Total power while wielding a sword']
  ]),
  [TRAIT.HARD_TO_CATCH]: traitTooltip('Completing a movement skill restores endurance.', [
    ['resourceGain', 'Endurance restored']
  ]),
  [TRAIT.ASSASSINS_REWARD]: outsideScopeTooltip,
  [TRAIT.UPPER_HAND]: traitTooltip('Completing a dodge restores initiative.', [
    ['resourceGain', 'Initiative restored'],
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.DONT_STOP]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;

/** Preview descriptions expose the new mechanics and identify assumptions without changing Live tooltips. */
export const thiefAcrobaticsReworkTooltips = {
  [REWORK.DEFT_INITIATION]: traitTooltip(
    'Combat entry arms your next direct strike. Completing movement or a shadowstep rearms it once; rewards follow the hit. Might/vulnerability tuning and no internal cooldown are provisional.',
    [['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.FELINE_GRACE]: traitTooltip(
    'Completing movement or a shadowstep grants self swiftness. Duration and no internal cooldown are provisional; improved movement speed is outside scope.',
    [['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]]
  ),
  [REWORK.OPPORTUNE_OPENING]: traitTooltip(
    'Deft Initiation inflicts cripple. Strike damage increases against crippled, chilled, or immobilized targets; default target assumptions keep this active. Strike-only multiplicative scaling and tuning are provisional.',
    [['damageIncrease', 'Provisional strike damage', tooltipPercent]]
  ),
  [REWORK.ENDURANCE_TRAINING]: traitTooltip(
    'Successful evades grant vigor. Incoming attacks and successful evades are outside simulation scope.'
  ),
  [TRAIT.ASSASSINS_REWARD]: traitTooltip(
    'Deft Initiation heals you. Healing is outside simulation scope; player health stays full.'
  ),
  [TRAIT.HARD_TO_CATCH]: traitTooltip(
    'Completing Steal or a replacement grants resistance. Duration is provisional; defensive benefits are outside scope.'
  ),
  [REWORK.SHARP_INITIATION]: traitTooltip(
    'Deft Initiation deals an extra strike using the unequipped weapon-strength profile. Coefficient, strength profile and critical-hit eligibility are provisional. It has no separate cooldown and cannot retrigger Deft Initiation.'
  ),
  [TRAIT.DONT_STOP]: traitTooltip(
    'Each actual self-swiftness application restores capped endurance. Amount and no internal cooldown are provisional; zero cooldown permits separate same-instant rewards. Player condition removal is outside scope.',
    [
      ['resourceGain', 'Provisional endurance'],
      ['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
