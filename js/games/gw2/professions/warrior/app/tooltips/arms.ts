import {
  profileFact,
  simulationEffectFacts,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitSkillTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe arms tooltips from the selected balance data. */
export const warriorArmsTooltips = {
  [TRAIT.FURIOUS_BURST]: traitTooltip('Weapon swapping grants fury. Fury grants additional critical-strike chance.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds],
    ['criticalChance', 'Additional critical chance with fury', tooltipPercent]
  ]),
  [TRAIT.DEEP_STRIKES]: traitTooltip(
    'Gain condition damage while you have fury and critical-strike chance against bleeding targets.',
    [
      ['attributeBonuses.conditionDamage', 'Condition damage with fury'],
      ['criticalChance', 'Critical chance against bleeding targets', tooltipPercent]
    ]
  ),
  [TRAIT.BLOODLUST]: traitTooltip('Eligible critical hits can inflict bleeding. Bleeding lasts longer.', [
    ['procChance', 'Chance on critical hit', tooltipPercent]
  ]),
  [TRAIT.WOUNDING_PRECISION]: traitTooltip('Gain expertise from eligible precision.', [
    ['attributeConversion', 'Eligible precision converted to expertise', tooltipPercent]
  ]),
  [TRAIT.SIGNET_MASTERY]: traitSkillTooltip(
    [ID.LESSER_SIGNET_OF_MIGHT],
    'Activating signets grants stacking ferocity. Striking below the target health threshold invokes Lesser Signet of Might.',
    [
      ['attributePerStack', 'Ferocity per stack'],
      ['maximumStacks', 'Maximum stacks'],
      ['threshold', 'Target health below', tooltipPercent]
    ]
  ),
  [TRAIT.OPPORTUNIST]: traitTooltip('Player control or immobilize applications grant adrenaline and fury.', [
    ['resourceGain', 'Adrenaline gained'],
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.UNSUSPECTING_FOE]: traitTooltip('Gain critical-strike chance against defiant targets.', [
    ['criticalChance', 'Critical chance', tooltipPercent]
  ]),
  [TRAIT.SUNDERING_BURST]: (balanceContext, entity) => {
    const profile = tooltipProfile(balanceContext, entity.id);
    return {
      description: 'The first burst hit inflicts vulnerability. A critical hit uses the stronger application instead.',
      facts: [
        profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
        ...(profile.effects || []).flatMap(
          (effect, index) => simulationEffectFacts([effect], index === 0 ? 'noncritical hit' : 'critical hit').facts
        )
      ]
    };
  },
  [TRAIT.BLADEMASTER]: traitTooltip('Gain expertise. Wielding a sword also grants condition damage.', [
    ['attributeBonuses.expertise', 'Expertise'],
    ['attributeBonuses.conditionDamage', 'Condition damage with a sword']
  ]),
  [TRAIT.BURST_PRECISION]: traitTooltip(
    'Burst hits gain critical-strike chance and open a temporary critical-chance and ferocity window. The highest adrenaline tier grants the longer window.',
    [
      ['criticalChance', 'Critical chance', tooltipPercent],
      ['attributeBonuses.ferocity', 'Ferocity during the window'],
      ['minimumStacks', 'Base window', tooltipSeconds],
      ['maximumStacks', 'Highest-tier window', tooltipSeconds]
    ]
  ),
  [TRAIT.FURIOUS]: traitTooltip('Eligible critical hits grant adrenaline and stacking condition damage.', [
    ['resourceGain', 'Adrenaline per critical hit'],
    ['attributePerStack', 'Condition damage per stack'],
    ['maximumStacks', 'Maximum stacks']
  ]),
  [TRAIT.DUAL_WIELDING]: traitTooltip(
    'Skills with measured Dual Wielding timings cast faster while using an eligible offhand weapon.'
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
