import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  fromProfile,
  profileFact,
  simulationEffectFacts,
  tooltipFactorChange,
  tooltipPercent,
  tooltipPercentValue,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe deadly arts tooltips from the selected balance data. */
export const thiefDeadlyArtsTooltips = {
  // The description already distinguishes the ordinary poison application from Potent Poison's stack bonus.
  [TRAIT.SERPENTS_TOUCH]: traitTooltip(
    'Stealing poisons the target. Potent Poison replaces the base application with more stacks.',
    [['playerStacks', 'Poison stacks with Potent Poison']]
  ),
  [TRAIT.LOTUS_POISON]: traitTooltip('Applying your own poison grants might and weakens the target.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.EXPOSED_WEAKNESS]: traitTooltip('Deal increased strike damage for each different condition on the target.', [
    fromProfile(TRAIT.EXPOSED_WEAKNESS, 'damagePerCondition', 'Strike damage per condition', tooltipPercent)
  ]),
  // State the full weapon-dependent bonus so build-only attributes are not hidden by empty profiles.
  [TRAIT.DAGGER_TRAINING]: traitTooltip('Gain power and additional power while wielding a dagger.', [
    ['attributeBonuses.power', 'Power'],
    ['conditionalAttributeBonuses.power', 'Total power while wielding a dagger']
  ]),
  [TRAIT.MUG]: traitTooltip(
    'Stealing deals an additional strike that cannot critically strike. Healing is outside combat simulation scope.'
  ),
  [TRAIT.DEADLY_AMBITION]: traitTooltip(
    "Gain condition damage. The first landed player strike of a dual attack poisons the target. Potent Poison replaces the base application with more stacks. Current in-game bug: another player-owned strike landing during Death Blossom before its first hit consumes that cast's poison proc without applying poison.",
    [
      ['attributeBonuses.conditionDamage', 'Condition damage'],
      ['playerStacks', 'Poison stacks with Potent Poison']
    ],
    'base application'
  ),
  [TRAIT.EVEN_THE_ODDS]: traitTooltip('Stealing inflicts vulnerability.'),
  // Distinguish the strike cooldown from poison on every immobilize, including the live stack-count bug.
  [TRAIT.PANIC_STRIKE]: (balanceContext, entity) => {
    const profile = tooltipProfile(balanceContext, entity.id);
    const effects = (condition: string) =>
      simulationEffectFacts(
        profile.effects?.filter((effect) => effect.type === 'condition' && effect.condition === condition)
      ).facts;
    return {
      description:
        'Strike a target with enough different conditions to immobilize it. Your immobilize applications also inflict poison.',
      facts: [],
      factSections: [
        {
          label: 'Immobilize on strike',
          facts: [
            {
              ...profileFact(balanceContext, entity.id, 'threshold', 'Different conditions required'),
              icon: MODIFIER_EFFECT_ICONS['Condition Threshold']
            },
            ...effects(CONDITION.IMMOBILIZED),
            profileFact(balanceContext, entity.id, 'internalCooldown', 'Cooldown', tooltipSeconds)
          ]
        },
        {
          label: 'Poison on immobilize',
          description:
            'Current in-game bug: Potent Poison does not grant its extra stack here. The simulator uses one poison stack per immobilize.',
          facts: [
            ...effects(CONDITION.POISONED),
            {
              ...profileFact(balanceContext, entity.id, 'playerStacks', 'Stacks with Potent Poison'),
              icon: MODIFIER_EFFECT_ICONS[CONDITION.POISONED]
            }
          ]
        }
      ]
    };
  },
  [TRAIT.REVEALED_TRAINING]: traitTooltip('Gain power and additional power while revealed.', [
    ['attributeBonuses.power', 'Power'],
    ['conditionalAttributeBonuses.power', 'Additional power while revealed']
  ]),
  [TRAIT.POTENT_POISON]: traitTooltip(
    "Poison deals increased damage and lasts longer. Serpent's Touch and Deadly Ambition apply additional poison stacks. Current in-game bug: Panic Strike does not receive its extra stack.",
    [
      fromProfile(TRAIT.POTENT_POISON, 'conditionDamageMultiplier', 'Poison damage', tooltipFactorChange),
      ['conditionDurationBonus', 'Poison duration', tooltipPercent]
    ]
  ),
  // Group replacement profession mechanics so each resource bonus and recharge trigger has a clear owner.
  [TRAIT.IMPROVISATION]: (balanceContext, entity) => ({
    description: 'Gain extra uses or resources from your profession skill, depending on your specialization.',
    facts: [],
    factSections: [
      {
        label: 'Stolen skills',
        description: 'Reuse the same chosen skill.',
        facts: [profileFact(balanceContext, entity.id, 'maximumStacks', 'Stolen skill uses')]
      },
      {
        label: 'Siphon',
        description: 'The bonus also applies to Shadow Force added by Amplified Siphoning.',
        facts: [profileFact(balanceContext, entity.id, 'lifeForceGain', 'Shadow Force gain', tooltipPercent)]
      },
      {
        label: 'Skritt Swipe',
        description:
          'Adds artifact uses alongside Prolific Plunderer. Shortens the active recharge of each equipped utility skill.',
        facts: [
          profileFact(balanceContext, entity.id, 'resourceGain', 'Additional artifact uses'),
          profileFact(
            balanceContext,
            entity.id,
            'rechargeMultiplier',
            'Recharge removed',
            (value) => `${tooltipPercentValue(1 - value)} of base recharge`
          ),
          profileFact(balanceContext, entity.id, 'internalCooldown', 'Recharge reduction cooldown', tooltipSeconds)
        ]
      }
    ]
  }),
  [TRAIT.EXECUTIONER]: traitTooltip('Deal increased strike damage against targets below half health.', [
    fromProfile(TRAIT.EXECUTIONER, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
