import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

const willbenderVirtueTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  const index = entity.id === ID.RUSHING_JUSTICE ? 0 : entity.id === ID.FLOWING_RESOLVE ? 1 : 2;
  return {
    description:
      "Activate this virtue's temporary hit-trigger window and lay Willbender Flames. Trails from the same virtue can overlap; switching virtues cancels the previous trails. Eligible hits advance virtue triggers; partial progress persists between active windows. Justice triggers Burning; Courage triggers defensive boons. Resolve healing is outside combat simulation scope, but its trait effects still apply.",
    facts: [
      ...simulationEffectFacts(selected.effects).facts,
      ...simulationEffectFacts(
        requireSkillAction(selected, 'virtue').effects.filter((effect) => effect.type === 'buff'),
        'base active window'
      ).facts,
      ...simulationEffectFacts(
        requireSkillFromContext(
          balanceContext,
          [ID.WILLBENDER_FLAMES_ID_62618, ID.WILLBENDER_FLAMES, ID.WILLBENDER_FLAMES_COURAGE][index]
        ).effects,
        'full flame trail'
      ).facts,
      profileFact(balanceContext, TRAIT.WILLBENDER_TRAINING, 'threshold', 'Base eligible hits per trigger'),
      ...(index === 2
        ? simulationEffectFacts(
            requireSkillAction(selected, 'virtue').effects.filter((effect) => effect.type === 'boon'),
            'per Courage trigger'
          ).facts
        : [])
    ]
  };
};

/** Describe willbender tooltips from the selected balance data. */
export const willbenderTooltips = {
  skills: {
    ...Object.fromEntries(
      [ID.CRASHING_COURAGE, ID.FLOWING_RESOLVE, ID.RUSHING_JUSTICE].map((id) => [id, willbenderVirtueTooltip])
    ),
    [ID.FLASH_COMBO]: skillTooltip('Strike repeatedly and unlock Repose for its temporary follow-up window.')
  },
  traits: {
    [TRAIT.WILLBENDER_TRAINING]: traitTooltip(
      'Replace passive virtues with active Willbender virtue windows and their hit-triggered effects.'
    ),
    [TRAIT.RIGHTEOUS_SPRINT]: outsideScopeTooltip,
    [TRAIT.LETHAL_TEMPO]: traitTooltip(
      'Virtue activations and completed virtue triggers grant stacking damage. New grants refresh the active stack window.',
      [
        ['maximumStacks', 'Maximum stacks'],
        fromProfile(TRAIT.LETHAL_TEMPO, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(TRAIT.LETHAL_TEMPO, 'conditionDamageIncreasePerStack', 'Condition damage per stack', tooltipPercent)
      ]
    ),
    [TRAIT.SEARING_PACT]: traitTooltip('Gain condition damage. Willbender flames also inflict burning.', [
      ['attributeBonuses.conditionDamage', 'Condition damage']
    ]),
    [TRAIT.POWER_FOR_POWER]: traitTooltip('Gain power. Willbender flame strikes deal increased damage.', [
      ['attributeBonuses.power', 'Power'],
      fromProfile(TRAIT.POWER_FOR_POWER, 'damageMultiplier', 'Willbender flame strike damage', tooltipFactorChange)
    ]),
    [TRAIT.CONCEITED_CURATE]: traitTooltip('Gain vitality.', [['attributeBonuses.vitality', 'Vitality']]),
    [TRAIT.RESTORATIVE_VIRTUES]: traitTooltip(
      'Activating Resolve grants vigor. Completed virtue triggers reduce active-weapon cooldowns.',
      [['rechargeReduction', 'Weapon recharge reduction per trigger', tooltipSeconds]]
    ),
    [TRAIT.HOLY_RECKONING]: traitTooltip(
      'Completed virtue triggers grant might to the party. Rushing Justice also grants fury to yourself.'
    ),
    [TRAIT.VANGUARD_TACTICS]: outsideScopeTooltip,
    [TRAIT.PHOENIX_PROTOCOL]: traitTooltip(
      'Activating Resolve grants alacrity; completed Resolve triggers grant the shorter application. Battle Presence shares these applications with the party.'
    ),
    [TRAIT.TYRANTS_MOMENTUM]: traitTooltip(
      'Lethal Tempo grants stronger damage bonuses with a shorter stack window. Rushing Justice uses the extended Justice window.',
      [
        fromProfile(TRAIT.TYRANTS_MOMENTUM, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          TRAIT.TYRANTS_MOMENTUM,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.DEATHLESS_COURAGE]: outsideScopeTooltip
  }
} satisfies ProfessionTooltips;
