import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipHasTrait,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { balanceNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
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
        requireSkill(
          balanceContext.catalog,
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

/** Both Tempo cards show the per-stack and full-stack bonuses together using the same stack cap. */
const tempoTooltip: DescribeSimulationTooltip = (context, trait, _specialization, build) => {
  const momentum = trait.id === TRAIT.TYRANTS_MOMENTUM;
  const modified = momentum || tooltipHasTrait(context, build, TRAIT.TYRANTS_MOMENTUM);
  const profile = tooltipProfile(context, modified ? TRAIT.TYRANTS_MOMENTUM : TRAIT.LETHAL_TEMPO);
  const tempo = requireEffect(profile, 'buff', 'lethal-tempo');
  const justice = momentum && requireEffect(profile, 'buff', 'justice');
  const cap = balanceNumber(context.catalog, TRAIT.LETHAL_TEMPO, 'maximumStacks');
  const damageFact = (name: string, field: string) => {
    const bonus = tooltipNumber(profile, field);
    return { name, detail: `${tooltipPercent(bonus)} per stack, ${tooltipPercent(bonus * cap)} at ${cap} stacks` };
  };

  return {
    description: momentum
      ? 'Lethal Tempo stacks grant more damage and expire sooner. Rushing Justice stays active longer.'
      : 'Gain Lethal Tempo when you activate a virtue or trigger its effect by landing hits. Each gain refreshes all stacks.',
    facts: [
      ...(tempo
        ? [
            damageFact('Strike damage', 'damageIncreasePerStack'),
            damageFact('Condition damage', 'conditionDamageIncreasePerStack'),
            { name: 'Lethal Tempo duration', detail: tooltipSeconds(tooltipNumber(tempo, 'duration')) }
          ]
        : []),
      ...(justice
        ? [{ name: 'Rushing Justice duration', detail: tooltipSeconds(tooltipNumber(justice, 'duration')) }]
        : [])
    ]
  };
};

/** Describe willbender tooltips from the selected balance data. */
export const willbenderTooltips = {
  skills: {
    [ID.REVERSAL_OF_FORTUNE]: skillTooltip('Guard against the next incoming strike and heal yourself.'),
    [ID.REPOSE]: skillTooltip('Return to the starting point of Flash Combo to heal and cleanse conditions.'),
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
    [TRAIT.LETHAL_TEMPO]: tempoTooltip,
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
    [TRAIT.PHOENIX_PROTOCOL]: (context, trait) => {
      const profile = tooltipProfile(context, trait.id);
      const hits = balanceNumber(context.catalog, TRAIT.WILLBENDER_TRAINING, 'threshold');
      return {
        description:
          'Flowing Resolve grants alacrity to you and nearby allies. Your hits grant it again while Resolve is active.',
        facts: [
          [BOON.ALACRITY, 'On activation'],
          ['alacrity (triggered)', `Every ${hits} hits`]
        ].flatMap(([key, label]) => {
          const boon = requireEffect(profile, 'boon', key);
          return boon ? simulationEffectFacts([{ ...boon, name: boon.boon, packetLabel: undefined }], label).facts : [];
        })
      };
    },
    [TRAIT.TYRANTS_MOMENTUM]: tempoTooltip,
    [TRAIT.DEATHLESS_COURAGE]: outsideScopeTooltip
  }
} satisfies ProfessionTooltips;
