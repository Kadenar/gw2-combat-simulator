import {
  outsideScopeTooltip,
  profileFact,
  profileTooltip,
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
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { variantEffects } from '#gw2/professions/revenant/app/tooltips/shared.js';

const beguilingHazeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Strike and prepare follow-up charges. Each follow-up costs no energy and uses its smaller attack. The original main-cast recharge resumes after the charges are spent. Shared Wisdom grants its matching boon.',
  facts: [
    ...simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'main cast').facts,
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.BEGUILING_HAZE_FOLLOW_UP)!.effects,
      'per follow-up instead'
    ).facts,
    {
      name: 'Follow-up charges',
      detail: String(tooltipNumber(balanceContext.catalog.skillsById.get(ID.BEGUILING_HAZE_FOLLOW_UP), 'maximumStacks'))
    }
  ]
});

const hexEaterVortexTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Remove conditions from yourself and fire a tormenting projectile for each removed condition, up to the authored projectile limit. Equipping Demon fires the full salvo even without self-conditions. Shared Wisdom grants its matching boon.',
  facts: simulationEffectFacts(
    balanceContext.catalog.skillsById.get(entity.id)!.effects,
    'maximum salvo; fewer projectiles without Demon or enough self-conditions'
  ).facts
});

const gladiatorsDefenseTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike, weaken the target, and gain the listed boons when this action completes. Shared Wisdom adds its matching boon. Incoming attacks are not required to produce these simulated effects.'
);

const twinMoonSweepTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'You and a fragment strike together, applying bleeding and might. Both attacks are player-owned. Equipped Assassin adds immobilization; equipped Demon adds later shatter and confusion packets. Gain affinity once from the main hit; Shared Wisdom adds might.',
  ...variantEffects(balanceContext.catalog.skillsById.get(entity.id)!.effects)
});

const cosmicWisdomTooltip: DescribeSimulationTooltip = skillTooltip(
  'Enter the form associated with your active legend. Swapping legends changes the form during the window. Assassin triggers lesser daggers; Dervish triggers scythe attacks from Entity skills; Mesmer changes Demon skill costs. Affinity and Conduit traits modify these effects.',
  (balanceContext) => [
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS)!.effects,
      'Assassin form: per dagger trigger'
    ).facts,
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.FORM_OF_THE_DERVISH_ATTACK)!.effects,
      'Dervish form: per Entity cast'
    ).facts,
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.FORM_OF_THE_DERVISH_ATTACK_ELITE)!.effects,
      'Dervish form: additional Twin Moon Sweep attack'
    ).facts
  ]
);

const releasePotentialTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const effects = variantEffects(selected.effects, 'base values before affinity scaling');
  const conditions = selected.effects?.filter((effect) => effect.type === 'condition') || [];
  return {
    ...effects,
    description:
      "Release the power of your current form. Affinity increases the listed enemy-condition durations and reduces Mesmer's self-torment duration. Dervish gains its legend-specific effects from an equipped matching legend or sufficient affinity. Kinetic Insight adds virtual affinity for these calculations without spending your actual affinity.",
    facts: [
      ...effects.facts,
      ...conditions.flatMap((effect) => [
        ...(effect.durationPerAffinity == null
          ? []
          : [
              {
                name: `${effect.condition} duration per affinity`,
                detail: tooltipPercent(tooltipNumber(effect, 'durationPerAffinity'))
              }
            ]),
        ...(effect.durationReductionPerAffinity == null
          ? []
          : [
              {
                name: 'Self-torment duration reduction per affinity',
                detail: tooltipPercent(-tooltipNumber(effect, 'durationReductionPerAffinity'))
              }
            ])
      ]),
      ...(selected.id === ID.RELEASE_POTENTIAL_DERVISH
        ? [
            {
              name: 'Affinity for all Dervish legend effects',
              detail: String(
                tooltipNumber(
                  balanceContext.catalog.skillsById.get(ID.RELEASE_POTENTIAL_DERVISH),
                  'allLegendAffinityThreshold'
                )
              )
            }
          ]
        : [])
    ]
  };
};

/** Describe conduit tooltips from the selected balance data. */
export const conduitTooltips = {
  skills: {
    ...Object.fromEntries([ID.BEGUILING_HAZE, ID.BEGUILING_HAZE_ID_76805].map((id) => [id, beguilingHazeTooltip])),
    [ID.HEX_EATER_VORTEX]: hexEaterVortexTooltip,
    [ID.GLADIATORS_DEFENSE]: gladiatorsDefenseTooltip,
    ...Object.fromEntries([ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001].map((id) => [id, twinMoonSweepTooltip])),
    [ID.COSMIC_WISDOM]: cosmicWisdomTooltip,
    ...Object.fromEntries(
      [
        ID.RELEASE_POTENTIAL_MONK,
        ID.RELEASE_POTENTIAL_MESMER,
        ID.RELEASE_POTENTIAL_DERVISH,
        ID.RELEASE_POTENTIAL_ASSASSIN,
        ID.RELEASE_POTENTIAL_WARRIOR
      ].map((id) => [id, releasePotentialTooltip])
    )
  },
  traits: {
    [TRAIT.ENIGMATIC_CONNECTION]: traitTooltip(
      'Unlock Legendary Entity, affinity, Release Potential, and Cosmic Wisdom forms determined by the equipped legends.'
    ),
    [TRAIT.BOLSTERED_BONDS]: traitTooltip('Equipped legends grant attributes. Cosmic Wisdom increases these bonuses.', [
      ['assassinAttributeBonus', 'Assassin: power and ferocity'],
      ['demonAttributeBonus', 'Demon: condition damage and expertise'],
      ['dwarfAttributeBonus', 'Dwarf: toughness and vitality'],
      ['centaurAttributeBonus', 'Centaur: healing power and concentration'],
      ['entityAttributeBonus', 'Entity: each supported attribute'],
      ['attributeMultiplier', 'Cosmic Wisdom attribute increase', tooltipFactorChange]
    ]),
    [TRAIT.NUMINOUS_GIFT]: (balanceContext) => {
      const effects = variantEffects(tooltipProfile(balanceContext, CONDUIT.numinousGift).effects);
      return {
        ...effects,
        description:
          'Cosmic Wisdom grants might and boons determined by equipped legends. Targeted Destruction and Yearning Empowerment gain additional bonuses.',
        facts: [
          ...effects.facts,
          // Each enhancement identifies the affected trait with its catalog icon.
          {
            ...profileFact(
              balanceContext,
              CONDUIT.numinousGift,
              'damageIncrease',
              'Additional Targeted Destruction bonus',
              tooltipPercent
            ),
            icon: String(
              balanceContext.catalog.traits.find((trait) => trait.id === TRAIT.TARGETED_DESTRUCTION)?.icon || ''
            )
          },
          {
            ...profileFact(
              balanceContext,
              CONDUIT.numinousGift,
              'conditionDurationBonus',
              'Additional damaging-condition duration',
              tooltipPercent
            ),
            icon: String(
              balanceContext.catalog.traits.find((trait) => trait.id === TRAIT.YEARNING_EMPOWERMENT)?.icon || ''
            )
          }
        ]
      };
    },
    [TRAIT.CONDUCTIVE_ARMAMENTS]: traitTooltip('Casting weapon skills also generates affinity.'),
    [TRAIT.SHARED_WISDOM]: (balanceContext) => ({
      description: 'Entity skills grant swiftness. Specific Entity skills grant additional boons.',
      ...variantEffects(tooltipProfile(balanceContext, CONDUIT.sharedWisdom).effects)
    }),
    [TRAIT.LINGERING_DETERMINATION]: profileTooltip(
      CONDUIT.lingeringDetermination,
      'Swapping legends in combat grants affinity after the swap resets it.',
      [['resourceGain', 'Affinity gained']]
    ),
    [TRAIT.KINETIC_INSIGHT]: traitTooltip(
      'Release Potential recharges faster. Affinity scaling includes a virtual bonus without increasing stored affinity.',
      [
        ['rechargeMultiplier', 'Release Potential recharge', tooltipFactorChange],
        ['resourceGain', 'Virtual affinity bonus']
      ]
    ),
    [TRAIT.EXPANDED_CONSCIOUSNESS]: profileTooltip(
      CONDUIT.expandedConsciousness,
      'Reaching maximum affinity grants energy.',
      [['resourceGain', 'Energy gained']]
    ),
    [TRAIT.ETHEREAL_PURIFICATION]: outsideScopeTooltip,
    [TRAIT.MISTFIRE]: profileTooltip(
      CONDUIT.mistfire,
      'Control effects inflict burning. Twin Moon Sweep is excluded.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.ENHANCED_EMBODIMENT]: profileTooltip(
      CONDUIT.enhancedEmbodiment,
      'Legend swaps in combat recharge faster and extend Cosmic Wisdom.',
      [['rechargeMultiplier', 'Legend-swap recharge duration', tooltipFactorChange]]
    ),
    [TRAIT.FOUND_PURPOSE]: (balanceContext) => ({
      description: 'Swapping legends in combat shares the Numinous Gift boon package with nearby allies.',
      ...variantEffects(tooltipProfile(balanceContext, CONDUIT.numinousGift).effects)
    })
  }
} satisfies ProfessionTooltips;
