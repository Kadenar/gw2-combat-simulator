import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
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
    ['attributeBonus', 'Power'],
    ['weaponAttributeBonus', 'Total power while wielding a dagger']
  ]),
  [TRAIT.MUG]: traitTooltip(
    'Stealing deals an additional strike that cannot critically strike. Healing is outside combat simulation scope.'
  ),
  [TRAIT.DEADLY_AMBITION]: traitTooltip(
    'Gain condition damage. The first landed player strike of a dual attack poisons the target. Potent Poison replaces the base application with more stacks.',
    [
      ['attributeBonus', 'Condition damage'],
      ['playerStacks', 'Poison stacks with Potent Poison']
    ],
    'base application'
  ),
  [TRAIT.EVEN_THE_ODDS]: traitTooltip('Stealing inflicts vulnerability.'),
  [TRAIT.PANIC_STRIKE]: traitTooltip(
    'A strike against a target with enough different conditions immobilizes it. Your immobilize applications also poison the target; Potent Poison increases the poison stack count.',
    [
      ['threshold', 'Different conditions required'],
      ['internalCooldown', 'Immobilize cooldown', tooltipSeconds],
      ['playerStacks', 'Poison stacks with Potent Poison']
    ]
  ),
  [TRAIT.REVEALED_TRAINING]: traitTooltip('Gain power and additional power while revealed.', [
    ['attributeBonus', 'Power'],
    ['attributePerStack', 'Additional power while revealed']
  ]),
  [TRAIT.POTENT_POISON]: traitTooltip(
    "Poison deals increased damage and lasts longer. Serpent's Touch, Deadly Ambition, and Panic Strike apply additional poison stacks.",
    [
      fromProfile(TRAIT.POTENT_POISON, 'conditionDamageMultiplier', 'Poison damage', tooltipFactorChange),
      ['conditionDurationBonus', 'Poison duration', tooltipPercent]
    ]
  ),
  [TRAIT.IMPROVISATION]: traitTooltip(
    'Use the same stolen skill more than once. Increase Shadow Force gained from Siphon, including Amplified Siphoning. Skritt Swipe grants an additional artifact use, stacking with Prolific Plunderer, and reduces the active cooldowns of selected utility skills.',
    [
      ['maximumStacks', 'Stolen skill uses'],
      ['resourceGain', 'Additional artifact use from Skritt Swipe'],
      ['lifeForceGain', 'Additional Shadow Force gain from Siphon', tooltipPercent],
      [
        'rechargeMultiplier',
        'Utility recharge removed, as a fraction of base recharge',
        (value) => tooltipPercent(1 - value)
      ],
      ['internalCooldown', 'Utility reduction cooldown', tooltipSeconds]
    ]
  ),
  [TRAIT.EXECUTIONER]: traitTooltip('Deal increased strike damage against targets below half health.', [
    fromProfile(TRAIT.EXECUTIONER, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
