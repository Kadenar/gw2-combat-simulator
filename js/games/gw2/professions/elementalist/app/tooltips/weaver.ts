import { requireSkillAction, skillActionEffects } from '#gw2/platform/effects/actions.js';
import {
  fromProfile,
  fromSkill,
  fromModifier,
  outsideScopeTooltip,
  skillFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS } from '#gw2/professions/elementalist/specializations/weaver/mechanics/attunements.js';
import { primordialStancePayload } from '#gw2/professions/elementalist/specializations/weaver/skills/slot-skills.js';
import { WEAVER_SPEAR_BUFFS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';

/** Describe weaver tooltips from the selected balance data. */
export const weaverTooltips = {
  skills: {
    ...Object.fromEntries(
      Object.keys(WEAVER_SPEAR_BUFFS).map((id) => [
        id,
        skillTooltip(
          'Gain the immediate benefits and arm a follow-up. Your next successful player strike consumes the armed buff, applying this skill’s additional strike and conditions. Different spear follow-ups can share the same triggering strike.',
          (_balanceContext, skill) => {
            const action = requireSkillAction(skill, 'additional-strike');

            // Keep the selected arming window separate from rewards that require a later hit.
            return [
              ...simulationEffectFacts(
                action.effects.filter((effect) => effect.type === 'buff'),
                'follow-up window'
              ).facts,
              ...simulationEffectFacts(
                action.effects.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
                'on the next qualifying strike'
              ).facts
            ];
          }
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.PRIMORDIAL_STANCE_FIRE, ID.PRIMORDIAL_STANCE_WATER, ID.PRIMORDIAL_STANCE_AIR, ID.PRIMORDIAL_STANCE_EARTH].map(
        (id) => [
          id,
          (balanceContext) => ({
            description:
              "Pulse strike damage and conditions throughout the stance. Each pulse reads your current primary and secondary attunements: each hand supplies its element's condition, so a shared attunement applies that condition twice. The strike occurs once per pulse.",
            facts: simulationEffectFacts(
              primordialStancePayload(balanceContext).action.effects,
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
          [fromSkill(id, 'orbDuration', 'Refreshed orb duration', tooltipSeconds)]
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.FROSTFIRE_FLURRY, ID.PURBLINDING_PLASMA, ID.MOLTEN_METEOR, ID.FLOWING_FINESSE, ID.ENERVATING_EARTH].map(
        (id) => [
          id,
          skillTooltip(
            "Apply this dual attack's effects. For each of its elements, consume a stocked bullet for the corresponding enhancement or stock a bullet when none is available. Air bullets can additionally shorten Purblinding Plasma's recharge or add control to Enervating Earth.",
            (balanceContext, skill) => [
              ...simulationEffectFacts(
                // Name the required bullet directly; the description already explains consumption.
                skillActionEffects(skill).map((effect) => ({ ...effect, name: `${effect.name} bullet` }))
              ).facts,
              ...(id === ID.PURBLINDING_PLASMA
                ? [
                    skillFact(
                      balanceContext,
                      id,
                      'airBulletRechargeMultiplier',
                      'Recharge with Air bullet',
                      tooltipFactorChange
                    )
                  ]
                : [])
            ]
          )
        ]
      )
    ),
    [ID.ECHOING_EROSION]: skillTooltip(
      "Apply the dual attack's effects and update its Water and Earth bullets: consume each stocked bullet, or stock it when absent. The bullet enhancements add no separate damage payload in this simulation."
    ),
    [ID.WEAVE_SELF]: skillTooltip(
      `Begin Weave Self and rapidly cycle attunements; attunements recharge in ${WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS} seconds while it is active. Fire increases condition damage; Air increases strike damage. Visiting every element grants Perfect Weave and unlocks Tailored Victory. Recharge begins when Weave Self activates.`,
      [
        fromSkill(ID.WEAVE_SELF, 'duration', 'Weave Self window', tooltipSeconds),
        fromSkill(ID.WEAVE_SELF, 'flipDuration', 'Perfect Weave window', tooltipSeconds),
        fromModifier('elementalist.weave-self-air', 'amount', 'Air strike damage'),
        fromModifier('elementalist.weave-self-fire', 'amount', 'Fire condition damage')
      ]
    ),
    [ID.TAILORED_VICTORY]: skillTooltip(
      'Consume Perfect Weave and apply the control effect. Requires an active Perfect Weave window.'
    ),
    [ID.UNRAVEL]: skillTooltip(
      'Align both hands to your primary attunement and reset all attunement recharges. Gain the matching elemental boon; the hands remain aligned during the window.',
      (balanceContext, skill) => [
        skillFact(balanceContext, ID.UNRAVEL, 'duration', 'Unravel window', tooltipSeconds),
        ...simulationEffectFacts(skillActionEffects(skill), 'primary attunement alternative').facts
      ]
    ),
    [ID.FERVENT_STANCE]: skillTooltip(
      "Apply the stance's immediate effects and arm might grants for completed dual attacks.",
      (balanceContext, skill) => [
        skillFact(balanceContext, ID.FERVENT_STANCE, 'duration', 'Stance window', tooltipSeconds),
        ...simulationEffectFacts(skillActionEffects(skill), 'per completed dual attack').facts
      ]
    )
  },
  traits: {
    [TRAIT.WEAVER]: traitTooltip(
      'Unlock Weaver, sword, stances, and dual attunements. Weapon skills depend on your primary and secondary elements.'
    ),
    [TRAIT.ELEMENTAL_REFRESHMENT]: traitTooltip('Gain vitality. Barrier does not change outgoing combat results.', [
      ['attributeBonuses.vitality', 'Vitality']
    ]),
    [TRAIT.ELEMENTAL_POLYPHONY]: traitTooltip(
      'Gain attributes from each distinct active attunement: Fire grants power, Water healing power, Air ferocity, and Earth condition damage. Matching elements apply once.',
      [
        ['attributeBonuses.power', 'Power in Fire'],
        ['attributeBonuses.ferocity', 'Ferocity in Air'],
        ['attributeBonuses.healingPower', 'Healing power in Water'],
        ['attributeBonuses.conditionDamage', 'Condition damage in Earth']
      ]
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
