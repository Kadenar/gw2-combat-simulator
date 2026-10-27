import {
  outsideScopeTooltip,
  tooltipFactorChange,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Describe valor tooltips from the selected balance data. */
export const guardianValorTooltips = {
  [TRAIT.VALOROUS_DEFENSE]: outsideScopeTooltip,
  [TRAIT.STEADFAST_COURAGE]: outsideScopeTooltip,
  [TRAIT.MIGHT_OF_THE_PROTECTOR]: outsideScopeTooltip,
  [TRAIT.STRENGTH_OF_THE_FALLEN]: outsideScopeTooltip,
  [TRAIT.SMITERS_BOON]: outsideScopeTooltip,
  [TRAIT.FOCUS_MASTERY]: traitTooltip('Focus skills recharge faster.', [
    ['rechargeMultiplier', 'Focus recharge duration', tooltipFactorChange]
  ]),
  [TRAIT.STALWART_DEFENDER]: traitTooltip('Gain toughness while wielding an off-hand shield.', [
    ['attributeBonuses.toughness', 'Toughness with an off-hand shield']
  ]),
  [TRAIT.REDEMPTION]: outsideScopeTooltip,
  [TRAIT.COMMUNAL_DEFENSES]: outsideScopeTooltip,
  [TRAIT.ALTRUISTIC_HEALING]: outsideScopeTooltip,
  [TRAIT.MONKS_FOCUS]: outsideScopeTooltip,
  [TRAIT.TENACIOUS_DEFENSE]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
