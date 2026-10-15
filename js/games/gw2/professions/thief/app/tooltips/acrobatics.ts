import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe acrobatics tooltips from the selected balance data. */
export const thiefAcrobaticsTooltips = {
  [TRAIT.EXPEDITIOUS_DODGER]: outsideScopeTooltip,
  [TRAIT.FELINE_GRACE]: outsideScopeTooltip,
  [TRAIT.FLUID_STRIKES]: traitTooltip('Completing a movement skill temporarily increases strike damage.', [
    fromProfile(TRAIT.FLUID_STRIKES, 'damageIncrease', 'Strike damage', tooltipPercent),
    ['durationMultiplier', 'Bonus duration', tooltipSeconds]
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
