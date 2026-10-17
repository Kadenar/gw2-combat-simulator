import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as UNTAMED } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';

/** Replace the delivery marker with its selected trait payload when describing ambush damage. */
const ambushTooltip: DescribeSimulationTooltip = (context, entity) => {
  const skill = context.catalog.skillsById.get(entity.id)!;
  const effects = skill.effects?.flatMap((effect) =>
    effect.type === 'custom' && effect.eventType === 'ranger.natural-fortitude'
      ? (tooltipProfile(context, TRAIT.NATURAL_FORTITUDE).effects ?? [])
      : [effect]
  );
  return {
    ...simulationEffectFacts(effects),
    description: 'Use the available unleashed ambush and consume its window. Apply eligible ambush traits.'
  };
};

/** Compose untamed descriptions using the selected catalog's balance data. */
export const untamedTooltips = {
  skills: {
    [ID.UNLEASH_RANGER]: skillTooltip(
      "Unleash yourself and restore your pet's ordinary commands. Open a temporary unleashed-ambush window when the shared ambush cooldown is ready.",
      [
        fromProfile(UNTAMED.resources, 'duration', 'Ambush window', tooltipSeconds),
        fromProfile(UNTAMED.resources, 'internalCooldown', 'Ambush grant cooldown', tooltipSeconds)
      ]
    ),
    [ID.UNLEASH_PET]: skillTooltip(
      'Unleash your pet and replace its commands with unleashed skills. Your weapon and trait effects follow the pet-unleashed state.'
    ),
    ...Object.fromEntries(UNTAMED_AMBUSH_SKILL_IDS.map((id) => [id, ambushTooltip])),
    [ID.EXPLODING_SPORES]: skillTooltip(
      'Strike, poison, and control the target. Gain might if you were unleashed at cast start, or protection if your pet was unleashed.',
      (balanceContext) => [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, UNTAMED.explodingSporesRanger).effects,
          'ranger unleashed; alternative'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, UNTAMED.explodingSporesPet).effects,
          'pet unleashed; alternative'
        ).facts
      ]
    ),
    [ID.VENOMOUS_OUTBURST]: skillTooltip(
      'Your unleashed pet attacks. It additionally applies vulnerability against a defiant target.'
    )
  },
  traits: {
    [TRAIT.UNLEASHED_POWER]: traitTooltip(
      'Unlock Untamed, hammer, cantrips, and unleash. Swap unleashed power between yourself and your pet to change available skills.'
    ),
    [TRAIT.NATURAL_FORTITUDE]: traitTooltip('Gain vitality. Ambushes trigger a life siphon at their first impact.', [
      ['attributeBonus', 'Vitality']
    ]),
    [TRAIT.VOW_OF_THE_UNTAMED]: traitTooltip('Your strikes deal increased damage while you are unleashed.', [
      fromProfile(TRAIT.VOW_OF_THE_UNTAMED, 'damageIncrease', 'Unleashed player strike damage', tooltipPercent)
    ]),
    [TRAIT.DEBILITATING_BLOWS]: (balanceContext, entity) => ({
      description:
        'Player or pet control effects poison the target while you are unleashed, or slow it while the pet is unleashed.',
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'Ranger unleashed' : 'pet unleashed').facts
        )
      ]
    }),
    [TRAIT.NATURES_SHIELD]: outsideScopeTooltip,
    [TRAIT.BLINDING_OUTBURST]: traitTooltip(
      'Venomous Outburst blinds the target. Supported unleashed ambushes and Venomous Outburst deal increased strike damage.',
      [fromProfile(TRAIT.BLINDING_OUTBURST, 'damageIncrease', 'Eligible strike damage', tooltipPercent)]
    ),
    [TRAIT.ENHANCING_IMPACT]: (balanceContext, entity) => ({
      description:
        'Player or pet control effects grant quickness while you are unleashed, or stability while the pet is unleashed.',
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'Ranger unleashed' : 'pet unleashed').facts
        )
      ]
    }),
    [TRAIT.CLEANSING_UNLEASH]: outsideScopeTooltip,
    [TRAIT.CORRUPTING_VINES]: outsideScopeTooltip,
    [TRAIT.LET_LOOSE]: traitTooltip(
      'The first landed hit of an unleashed ambush grants might and quickness to the party. Weapon swapping can reset ambush availability.',
      [['internalCooldown', 'Weapon-swap reset cooldown', tooltipSeconds]],
      RECIPIENT.PARTY
    ),
    [TRAIT.BIORHYTHM]: outsideScopeTooltip,
    [TRAIT.FEROCIOUS_SYMBIOSIS]: traitTooltip(
      "Your strikes build the pet's strike-damage stacks; pet strikes build yours. Each side has an independent trigger cooldown and refreshes its stack duration.",
      [
        fromProfile(TRAIT.FEROCIOUS_SYMBIOSIS, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        ['maximumStacks', 'Maximum stacks per side'],
        ['duration', 'Stack duration', tooltipSeconds],
        ['internalCooldown', 'Cooldown per side', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
