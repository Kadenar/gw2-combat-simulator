import {
  attributeConversionFact,
  fromProfile,
  fromSkill,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Show the dodge attack first, then the damage bonus that starts when the dodge ends. */
function dodgeAttackTooltip(
  description: string,
  attackName: string,
  bonusField: string,
  bonusLabel: string
): DescribeSimulationTooltip {
  return (context, trait) => {
    const profile = tooltipProfile(context, trait.id);
    const attack = simulationEffectFacts(
      profile.effects?.map((effect) =>
        effect.type === 'strike' && effect.name === trait.name ? { ...effect, name: undefined } : effect
      )
    );
    return {
      description,
      facts: [],
      incomplete: attack.incomplete,
      factSections: [
        { label: attackName, facts: attack.facts },
        {
          label: 'After the dodge',
          facts: [
            profileFact(
              context,
              trait.id,
              bonusField,
              bonusLabel,
              (value) => `${tooltipPercent(value)} for ${tooltipSeconds(tooltipNumber(profile, 'duration'))}`
            )
          ]
        }
      ]
    };
  };
}

/** Describe daredevil tooltips from the selected balance data. */
export const daredevilTooltips = {
  skills: {
    [ID.CHANNELED_VIGOR]: skillTooltip('Channel to restore endurance and heal yourself with each pulse.'),
    [ID.BANDITS_DEFENSE]: skillTooltip('Briefly block incoming attacks. A counterattack requires an incoming hit.'),
    [ID.FIST_FLURRY]: skillTooltip('Land the completed flurry to unlock Palm Strike for a limited window.', [
      fromSkill(ID.FIST_FLURRY, 'flipDuration', 'Palm Strike window', tooltipSeconds)
    ]),
    [ID.PALM_STRIKE]: skillTooltip('Consume the follow-up unlocked by a completed Fist Flurry.')
  },
  traits: {
    [TRAIT.PHYSICAL_SUPREMACY]: traitTooltip(
      'Unlock Daredevil, staff, physical skills, and an increased endurance capacity.'
    ),
    // The dodge limits when you can apply weakness. Any source of weakness enables the damage bonus.
    [TRAIT.WEAKENING_STRIKES]: (context, trait) => {
      const profile = tooltipProfile(context, trait.id);
      const window = tooltipSeconds(tooltipNumber(profile, 'duration'));
      const weakness = simulationEffectFacts(profile.effects);
      return {
        ...weakness,
        description: `After a dodge, your next strike inflicts weakness if it lands within ${window}.`,
        facts: [
          ...weakness.facts,
          profileFact(context, trait.id, 'damageMultiplier', 'Strike damage against weakened foes', tooltipFactorChange)
        ]
      };
    },
    [TRAIT.ENDURANCE_THIEF]: traitTooltip('Stealing restores endurance.', [['resourceGain', 'Endurance restored']]),
    [TRAIT.MARAUDERS_RESILIENCE]: traitTooltip(
      'Gain vitality based on power. Bonuses from other attribute conversions do not count. Incoming damage is outside combat simulation scope.',
      [attributeConversionFact('Power', 'Vitality')]
    ),
    [TRAIT.ESCAPISTS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.BRAWLERS_TENACITY]: traitTooltip('Using an eligible physical utility or healing skill restores endurance.', [
      ['resourceGain', 'Endurance restored']
    ]),
    [TRAIT.STAFF_MASTER]: traitTooltip(
      'Gain power and additional power while wielding a staff. Spending initiative on staff skills restores endurance.',
      [
        ['attributeBonuses.power', 'Power'],
        ['conditionalAttributeBonuses.power', 'Total power while wielding a staff'],
        ['resourceGain', 'Endurance per initiative spent']
      ]
    ),
    [TRAIT.HAVOC_SPECIALIST]: traitTooltip('Deal increased strike damage while endurance is below maximum.', [
      fromProfile(TRAIT.HAVOC_SPECIALIST, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.IMPACTING_DISRUPTION]: traitTooltip(
      'Does not trigger: enemy skill interruptions are outside the simulator’s scope.'
    ),
    [TRAIT.LOTUS_TRAINING]: dodgeAttackTooltip(
      'Your dodge becomes Impaling Lotus. Throw daggers as you evade.',
      'Impaling Lotus',
      'conditionDamageIncrease',
      'Condition damage dealt'
    ),
    [TRAIT.UNHINDERED_COMBATANT]: traitTooltip(
      'Replace your dodge with Unhindered Combatant. Completing the dodge grants swiftness.'
    ),
    [TRAIT.BOUNDING_DODGER]: dodgeAttackTooltip(
      'Your dodge becomes Bound. Leap and strike when you land.',
      'Bound',
      'damageIncrease',
      'Strike damage dealt'
    )
  }
} satisfies ProfessionTooltips;
