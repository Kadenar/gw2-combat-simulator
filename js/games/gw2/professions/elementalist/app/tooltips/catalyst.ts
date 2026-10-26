import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import {
  fromProfile,
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
  ELEMENTALIST_JADE_SPHERE_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/** Describe catalyst tooltips from the selected balance data. */
export const catalystTooltips = {
  skills: {
    ...Object.fromEntries(
      Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS).map((id) => [
        id,
        skillTooltip(
          "Spend energy to deploy the matching attunement's Jade Sphere. Its field and pulses retain that element when you change attunement. Active spheres enhance matching augments and suspend ordinary energy generation.",
          [fromProfile(TRAIT.DEPTH_OF_ELEMENTS, 'resourceCost', 'Energy spent')]
        )
      ])
    ),
    [ID.RELENTLESS_FIRE]: skillTooltip(
      'Temporarily increase strike and condition damage. An active Fire Jade Sphere grants the longer window.',
      [
        fromModifier('elementalist.relentless-fire', 'amount', 'Strike damage'),
        fromModifier('elementalist.relentless-fire-condition', 'amount', 'Condition damage')
      ]
    ),
    [ID.SHATTERING_ICE]: skillTooltip(
      'Qualifying hits trigger an additional strike and Chilled during the buff. An active Water Jade Sphere grants the longer window.',
      (balanceContext, skill) => [
        skillFact(balanceContext, ID.SHATTERING_ICE, 'internalCooldown', 'Trigger interval', tooltipSeconds),
        ...simulationEffectFacts(requireSkillAction(skill, 'triggered-packet').effects, 'per trigger').facts
      ]
    ),
    [ID.ELEMENTAL_CELERITY]: skillTooltip(
      'Reset eligible weapon recharges in your primary attunement. Each authored boon requires its named Jade Sphere to remain active through completion.'
    )
  },
  traits: {
    [TRAIT.DEPTH_OF_ELEMENTS]: traitTooltip(
      'Unlock Catalyst, hammer, augments, energy, and Jade Sphere. Damage builds energy while the sphere is inactive.',
      // Capacity is shared with the live energy pool rather than duplicated on the unlock trait.
      [fromProfile(TRAIT.DEPTH_OF_ELEMENTS, 'maximumStacks', 'Maximum energy')]
    ),
    [TRAIT.ELEMENTAL_EMPOWERMENT]: traitTooltip(
      'Elemental Empowerment grants temporary increases to eligible power, precision, ferocity, condition damage, expertise, and concentration.',
      [
        ['attributePerStack', 'Attribute increase per stack', tooltipPercent],
        ['maximumStacks', 'Maximum stacks'],
        ['playerStacks', 'Initial stacks'],
        ['duration', 'Initial stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.ELEMENTAL_EPITOME]: traitTooltip(
      'Combos grant the aura corresponding to your primary attunement, with separate cooldowns for each element. Gaining an aura in combat grants Elemental Empowerment.',
      [['internalCooldown', 'Combo aura cooldown per attunement', tooltipSeconds]]
    ),
    [TRAIT.HARDENED_AURAS]: outsideScopeTooltip,
    [TRAIT.VICIOUS_EMPOWERMENT]: traitTooltip(
      'Control or immobilize effects in combat grant Elemental Empowerment and might.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.ENERGIZED_ELEMENTS]: traitTooltip('Changing attunement grants energy and fury.', [
      ['resourceGain', 'Energy gained']
    ]),
    [TRAIT.EMPOWERING_AURAS]: traitTooltip(
      'Gaining an aura adds a damage-bonus stack and refreshes all active stacks.',
      [
        // Damage facts read the same trait balance fields as combat modifiers.
        ['damageIncreasePerStack', 'Strike damage per stack', tooltipPercent],
        ['conditionDamageIncreasePerStack', 'Condition damage per stack', tooltipPercent],
        ['maximumStacks', 'Maximum stacks'],
        ['duration', 'Stack duration', tooltipSeconds]
      ]
    ),
    [TRAIT.EVASIVE_EMPOWERMENT]: outsideScopeTooltip,
    [TRAIT.SPECTACULAR_SPHERE]: traitTooltip(
      "Deploying Jade Sphere grants quickness and the additional boon corresponding to the sphere's element."
    ),
    [TRAIT.ELEMENTAL_SYNERGY]: traitTooltip(
      'Combos grant an effect for your primary attunement: might in Fire, stability in Earth, or endurance in Air.',
      [
        ['internalCooldown', 'Cooldown per attunement', tooltipSeconds],
        ['resourceGain', 'Endurance in Air']
      ]
    ),
    [TRAIT.EMPOWERED_EMPOWERMENT]: traitTooltip(
      "Improve Elemental Empowerment's attribute scaling. At maximum stacks, use the full-set bonus instead of the per-stack rate.",
      [
        fromProfile(
          TRAIT.ELEMENTAL_EMPOWERMENT,
          'coefficientMultiplier',
          'Attribute increase per stack below maximum',
          tooltipPercent
        ),
        fromProfile(
          TRAIT.ELEMENTAL_EMPOWERMENT,
          'attributeConversion',
          'Attribute increase at maximum stacks',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.SPHERE_SPECIALIST]: traitTooltip("Spectacular Sphere's boons last longer.", [
      ['durationMultiplier', 'Boon duration', tooltipFactorChange]
    ])
  }
} satisfies ProfessionTooltips;
