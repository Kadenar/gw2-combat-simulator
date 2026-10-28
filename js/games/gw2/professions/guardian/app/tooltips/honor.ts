import {
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitSkillTooltip,
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
  [TRAIT.HONORABLE_STAFF]: traitTooltip('Gain concentration.', [['attributeBonuses.concentration', 'Concentration']]),
  [TRAIT.PURE_OF_HEART]: outsideScopeTooltip,
  [TRAIT.EMPOWERING_MIGHT]: traitTooltip(
    'Critical strikes grant might to the party, subject to an internal cooldown.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.PURE_OF_VOICE]: outsideScopeTooltip,
  [TRAIT.WRIT_OF_PERSISTENCE]: traitTooltip(
    'Symbols last longer: their fields are extended, and each symbol keeps pulsing its own payload on its own cadence.',
    [['durationExtension', 'Symbol duration increase', tooltipSeconds]]
  ),
  [TRAIT.FORCE_OF_WILL]: traitTooltip('Gain vitality.', [['attributeBonuses.vitality', 'Vitality']])
} satisfies NonNullable<ProfessionTooltips['traits']>;
