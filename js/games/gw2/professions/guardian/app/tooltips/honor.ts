import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  tooltipFactorChange,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Describe honor tooltips from the selected balance data. */
export const guardianHonorTooltips = {
  [TRAIT.VIGOROUS_PRECISION]: outsideScopeTooltip,
  [TRAIT.SELFLESS_DARING]: outsideScopeTooltip,
  [TRAIT.PURITY_OF_BODY]: outsideScopeTooltip,
  [TRAIT.INVIGORATED_BULWARK]: traitTooltip(
    'Mace skills have reduced recharge and increased base boon duration, before the normal boon-duration bonus cap.',
    [
      ['rechargeMultiplier', 'Mace recharge', tooltipFactorChange],
      ['durationMultiplier', 'Mace base boon duration', tooltipFactorChange]
    ]
  ),
  [TRAIT.PROTECTIVE_REVIVER]: outsideScopeTooltip,
  [TRAIT.PROTECTORS_RESTORATION]: traitSkillTooltip(
    [ID.LESSER_SYMBOL_OF_PROTECTION],
    'Committing a healing skill creates Lesser Symbol of Protection, striking the target and granting party protection.'
  ),
  [TRAIT.HONORABLE_STAFF]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
  [TRAIT.PURE_OF_HEART]: outsideScopeTooltip,
  [TRAIT.EMPOWERING_MIGHT]: traitTooltip(
    'Critical strikes grant might to the party, subject to an internal cooldown.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.PURE_OF_VOICE]: outsideScopeTooltip,
  [TRAIT.WRIT_OF_PERSISTENCE]: (balanceContext, entity) => {
    const effects = tooltipProfile(balanceContext, entity.id).effects || [];
    return {
      description:
        'Extend supported symbol fields and their strike pulses. Symbol of Punishment uses its separately authored extra strikes and might pulses; other symbols repeat their own final strike.',
      facts: [
        profileFact(balanceContext, entity.id, 'pulseInterval', 'Other symbol pulse interval', tooltipSeconds),
        profileFact(balanceContext, entity.id, 'boonDuration', 'Extended self boon duration', tooltipSeconds),
        profileFact(balanceContext, entity.id, 'boonStacks', 'Extended self boon stacks'),
        ...simulationEffectFacts(
          effects.filter((effect) => effect.type === 'buff'),
          'field extension'
        ).facts,
        ...simulationEffectFacts(
          effects.filter((effect) => effect.type !== 'buff'),
          'Symbol of Punishment only'
        ).facts
      ]
    };
  },
  [TRAIT.FORCE_OF_WILL]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']])
} satisfies NonNullable<ProfessionTooltips['traits']>;
