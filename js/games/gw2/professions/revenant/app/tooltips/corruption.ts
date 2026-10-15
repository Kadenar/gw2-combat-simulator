import {
  fromProfile,
  outsideScopeTooltip,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { variantEffects } from '#gw2/professions/revenant/app/tooltips/shared.js';

/** Describe corruption tooltips from the selected balance data. */
export const revenantCorruptionTooltips = {
  [TRAIT.INVOKING_TORMENT]: (balanceContext, entity) => ({
    description: 'Invoking a legend triggers Invoke Torment. Diabolic Inferno adds its separate condition packets.',
    ...variantEffects(tooltipProfile(balanceContext, entity.id).effects)
  }),
  [TRAIT.SEETHING_MALICE]: traitTooltip('Gain condition damage.', [
    ['attributeBonus', 'Condition Damage', (value) => '+' + tooltipDecimal(value)]
  ]),
  [TRAIT.YEARNING_EMPOWERMENT]: traitTooltip(
    'Damaging conditions last longer. Numinous Gift strengthens this duration bonus.',
    [['conditionDurationBonus', 'Damaging-condition duration', tooltipPercent]]
  ),
  [TRAIT.ACOLYTE_OF_TORMENT]: traitTooltip('Player-owned torment deals increased damage.', [
    fromProfile(TRAIT.ACOLYTE_OF_TORMENT, 'conditionDamageMultiplier', 'Torment damage', tooltipFactorChange)
  ]),
  [TRAIT.DEMONIC_DEFIANCE]: outsideScopeTooltip,
  [TRAIT.REPLENISHING_DESPAIR]: outsideScopeTooltip,
  [TRAIT.ABYSSAL_CHILL]: traitTooltip('Applying chill also inflicts torment.'),
  [TRAIT.DEMONIC_RESISTANCE]: outsideScopeTooltip,
  [TRAIT.PACT_OF_PAIN]: traitTooltip('Outgoing conditions last longer.', [
    ['conditionDurationBonus', 'Condition duration', tooltipPercent]
  ]),
  [TRAIT.DIABOLIC_INFERNO]: (balanceContext) => ({
    description: 'Invoke Torment applies additional conditions.',
    facts: simulationEffectFacts(tooltipProfile(balanceContext, TRAIT.DIABOLIC_INFERNO).effects).facts
  }),
  [TRAIT.FIENDISH_TENACITY]: outsideScopeTooltip,
  [TRAIT.PERMEATING_PESTILENCE]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
