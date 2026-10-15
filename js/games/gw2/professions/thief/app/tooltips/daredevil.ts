import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as DD } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe daredevil tooltips from the selected balance data. */
export const daredevilTooltips = {
  skills: {
    [ID.FIST_FLURRY]: skillTooltip('Land the completed flurry to unlock Palm Strike for a limited window.', [
      fromProfile(DD.palmStrike, 'durationMultiplier', 'Palm Strike window', tooltipSeconds)
    ]),
    [ID.PALM_STRIKE]: skillTooltip('Consume the follow-up unlocked by a completed Fist Flurry.')
  },
  traits: {
    [TRAIT.PHYSICAL_SUPREMACY]: traitTooltip(
      'Unlock Daredevil, staff, physical skills, and an increased endurance capacity.'
    ),
    [TRAIT.WEAKENING_STRIKES]: traitTooltip(
      'After dodging, your next landed player strike inflicts weakness. Deal increased strike damage to weakened targets.',
      [
        ['durationMultiplier', 'Time to land the strike', tooltipSeconds],
        fromProfile(
          TRAIT.WEAKENING_STRIKES,
          'damageMultiplier',
          'Strike damage against weakened targets',
          tooltipFactorChange
        )
      ]
    ),
    [TRAIT.ENDURANCE_THIEF]: traitTooltip('Stealing restores endurance.', [['resourceGain', 'Endurance restored']]),
    [TRAIT.MARAUDERS_RESILIENCE]: traitTooltip(
      'Gain vitality from eligible power. Incoming damage is outside combat simulation scope.',
      [['attributeConversion', 'Eligible power converted to vitality', tooltipPercent]]
    ),
    [TRAIT.ESCAPISTS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.BRAWLERS_TENACITY]: traitTooltip('Using an eligible physical utility or healing skill restores endurance.', [
      ['resourceGain', 'Endurance restored']
    ]),
    [TRAIT.STAFF_MASTER]: traitTooltip(
      'Gain power and additional power while wielding a staff. Spending initiative on staff skills restores endurance.',
      [
        ['attributeBonus', 'Power'],
        ['weaponAttributeBonus', 'Total power while wielding a staff'],
        ['resourceGain', 'Endurance per initiative spent']
      ]
    ),
    [TRAIT.HAVOC_SPECIALIST]: traitTooltip('Deal increased strike damage while endurance is below maximum.', [
      fromProfile(TRAIT.HAVOC_SPECIALIST, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.IMPACTING_DISRUPTION]: traitTooltip(
      'Does not trigger: enemy skill interruptions are outside the simulator’s scope.'
    ),
    [TRAIT.LOTUS_TRAINING]: traitTooltip(
      'Replace your dodge with Impaling Lotus, striking and applying conditions. Completing the dodge temporarily increases condition damage.',
      [
        fromProfile(TRAIT.LOTUS_TRAINING, 'conditionDamageIncrease', 'Condition damage', tooltipPercent),
        ['durationMultiplier', 'Bonus duration', tooltipSeconds]
      ]
    ),
    [TRAIT.UNHINDERED_COMBATANT]: traitTooltip(
      'Replace your dodge with Unhindered Combatant. Completing the dodge grants swiftness.'
    ),
    [TRAIT.BOUNDING_DODGER]: traitTooltip(
      'Replace your dodge with Bound, striking the target. Completing the dodge temporarily increases strike damage.',
      [
        fromProfile(TRAIT.BOUNDING_DODGER, 'damageIncrease', 'Strike damage', tooltipPercent),
        ['durationMultiplier', 'Bonus duration', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
