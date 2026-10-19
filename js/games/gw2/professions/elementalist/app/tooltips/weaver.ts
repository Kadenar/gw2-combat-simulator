import {
  fromProfile,
  fromModifier,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profile-ids.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as WEAVER } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';

/** Describe weaver tooltips from the selected balance data. */
export const weaverTooltips = {
  skills: {
    ...Object.fromEntries(
      [ID.PRIMORDIAL_STANCE_FIRE, ID.PRIMORDIAL_STANCE_WATER, ID.PRIMORDIAL_STANCE_AIR, ID.PRIMORDIAL_STANCE_EARTH].map(
        (id) => [
          id,
          (balanceContext) => ({
            description:
              "Pulse strike damage and conditions throughout the stance. Each pulse reads your current primary and secondary attunements: each hand supplies its element's condition, so a shared attunement applies that condition twice. The strike occurs once per pulse.",
            facts: simulationEffectFacts(
              tooltipProfile(balanceContext, WEAVER.primordialStance).effects,
              'per pulse; conditions depend on current attunements'
            ).facts
          })
        ]
      )
    ),
    ...Object.fromEntries(
      [
        ID.DUAL_ORBITS_FIRE_AND_WATER,
        ID.DUAL_ORBITS_FIRE_AND_AIR,
        ID.DUAL_ORBITS_FIRE_AND_EARTH,
        ID.DUAL_ORBITS_WATER_AND_AIR,
        ID.DUAL_ORBITS_WATER_AND_EARTH,
        ID.DUAL_ORBITS_AIR_AND_EARTH
      ].map((id) => [
        id,
        skillTooltip(
          'Create hammer orbs for both attunements and refresh all active orb durations. Grand Finale consumes those orbs. An existing matching orb must be consumed before this dual attack can create it again.',
          [fromProfile(CORE.hammerOrbs, 'duration', 'Refreshed orb duration', tooltipSeconds)]
        )
      ])
    ),
    ...Object.fromEntries(
      [
        [ID.FROSTFIRE_FLURRY, WEAVER.frostfireFlurry],
        [ID.PURBLINDING_PLASMA, WEAVER.purblindingPlasma],
        [ID.MOLTEN_METEOR, WEAVER.moltenMeteor],
        [ID.FLOWING_FINESSE, WEAVER.flowingFinesse],
        [ID.ENERVATING_EARTH, WEAVER.enervatingEarth]
      ].map(([id, profile]) => [
        id,
        skillTooltip(
          "Apply this dual attack's effects. For each of its elements, consume a stocked bullet for the corresponding enhancement or stock a bullet when none is available. Air bullets can additionally shorten Purblinding Plasma's recharge or add control to Enervating Earth.",
          (balanceContext) =>
            simulationEffectFacts(
              tooltipProfile(balanceContext, profile).effects,
              'only when consuming the named bullet'
            ).facts
        )
      ])
    ),
    [ID.ECHOING_EROSION]: skillTooltip(
      "Apply the dual attack's effects and update its Water and Earth bullets: consume each stocked bullet, or stock it when absent. The bullet enhancements add no separate damage payload in this simulation."
    ),
    [ID.WEAVE_SELF]: skillTooltip(
      'Begin Weave Self and rapidly cycle attunements. Fire increases condition damage; Air increases strike damage. Visiting every element grants Perfect Weave and unlocks Tailored Victory. The recharge begins when the active sequence ends.',
      [
        fromProfile(WEAVER.resources, 'duration', 'Weave Self window', tooltipSeconds),
        fromProfile(WEAVER.resources, 'recharge', 'Perfect Weave window', tooltipSeconds),
        fromModifier('elementalist.weave-self-air', 'amount', 'Air strike damage'),
        fromModifier('elementalist.weave-self-fire', 'amount', 'Fire condition damage')
      ]
    ),
    [ID.TAILORED_VICTORY]: skillTooltip(
      'Consume Perfect Weave and apply the control effect. Requires an active Perfect Weave window.'
    ),
    [ID.UNRAVEL]: skillTooltip(
      'Align both hands to your primary attunement and reset all attunement recharges. Gain the matching elemental boon; the hands remain aligned during the window.',
      (balanceContext) => [
        profileFact(balanceContext, WEAVER.unravel, 'duration', 'Unravel window', tooltipSeconds),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, WEAVER.unravel).effects,
          'primary attunement alternative'
        ).facts
      ]
    ),
    [ID.FERVENT_STANCE]: skillTooltip(
      "Apply the stance's immediate effects and arm might grants for completed dual attacks.",
      (balanceContext) => [
        profileFact(balanceContext, WEAVER.ferventStance, 'duration', 'Stance window', tooltipSeconds),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, WEAVER.ferventStance).effects,
          'per completed dual attack'
        ).facts
      ]
    )
  },
  traits: {
    [TRAIT.WEAVER]: traitTooltip(
      'Unlock Weaver, sword, stances, and dual attunements. Weapon skills depend on your primary and secondary elements.'
    ),
    [TRAIT.ELEMENTAL_REFRESHMENT]: traitTooltip('Gain vitality. Barrier does not change outgoing combat results.', [
      ['attributeBonus', 'Vitality']
    ]),
    [TRAIT.ELEMENTAL_POLYPHONY]: traitTooltip(
      'Gain attributes from each distinct active attunement: Fire grants power, Water healing power, Air ferocity, and Earth condition damage. Matching elements apply once.',
      [['attributeBonus', 'Bonus per corresponding attribute']]
    ),
    [TRAIT.SUPERIOR_ELEMENTS]: traitTooltip(
      'Completing an eligible dual attack inflicts weakness. Gain personal critical-strike chance against weakened targets.',
      [
        ['internalCooldown', 'Weakness cooldown', tooltipSeconds],
        ['criticalChance', 'Critical chance against weakened targets', tooltipPercent]
      ]
    ),
    [TRAIT.ELEMENTAL_PURSUIT]: traitTooltip('Player control effects grant swiftness.'),
    [TRAIT.WEAVERS_PROWESS]: traitTooltip('Fully attuning to an element grants resistance.'),
    [TRAIT.MASTERS_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.SWIFT_REVENGE]: traitTooltip(
      'Completing a dual attack grants benefits for its elements: Fire grants might, Air swiftness, and Earth endurance.',
      [['resourceGain', 'Endurance from Earth']]
    ),
    [TRAIT.BOLSTERED_ELEMENTS]: traitTooltip('Completing a stance grants protection.'),
    [TRAIT.ELEMENTS_OF_RAGE]: traitTooltip(
      'Fully attuning to an element grants a temporary strike- and condition-damage bonus.',
      [
        ['duration', 'Bonus duration', tooltipSeconds],
        fromProfile(TRAIT.ELEMENTS_OF_RAGE, 'damageIncrease', 'Strike damage', tooltipPercent),
        fromProfile(TRAIT.ELEMENTS_OF_RAGE, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
      ]
    ),
    [TRAIT.WOVEN_STRIDE]: outsideScopeTooltip,
    [TRAIT.FLOW_STATE]: traitTooltip("Reduce Weaver's attunement recharge and dual-attack recharge.", [
      ['rechargeReduction', 'Attunement recharge removed', tooltipSeconds],
      ['rechargeMultiplier', 'Dual-attack recharge', tooltipFactorChange]
    ])
  }
} satisfies ProfessionTooltips;
