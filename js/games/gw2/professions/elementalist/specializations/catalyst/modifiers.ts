import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/modifiers.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import type { CatalystEmpowermentPool } from '#gw2/professions/elementalist/build/types.js';

/**
 * Damage modifiers driven by Catalyst buff states: Empowering Auras adds its
 * per-stack bonus to strike and condition damage up to five stacks, and Relentless
 * Fire adds a flat bonus to both while its buff is active.
 */
export const catalystModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.empowering-auras-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, 'Empowering Auras')
  },
  {
    id: 'elementalist.empowering-auras-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, 'Empowering Auras')
  },
  {
    id: 'elementalist.relentless-fire',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'relentless fire', 1) > 0
  },
  {
    id: 'elementalist.relentless-fire-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'relentless fire', 1) > 0
  }
]);

function catalystModifierState(context: ElementalistModifierContext): CatalystStateLike {
  return readProfessionSpecializationState<CatalystStateLike>(context.runtime?.profession, 'Catalyst') || {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}

// Apply live Elemental Empowerment stacks as an all-attribute multiplier without
// mutating the shared resolved-stat object.
function modifyCatalystAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, 'Elemental Empowerment')) return attributes;

  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedStacks = activeStackCount(catalystModifierState(context).elementalEmpowermentExpiries || [], context.time);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment);
  const maximumStacks = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
  const stacks = Math.min(maximumStacks, timedStacks);
  // Empowered Empowerment replaces flat per-stack scaling with a coefficient ramp,
  // paying the full conversion only once every stack is up.
  const multiplier = hasTrait(context, 'Empowered Empowerment')
    ? stacks === maximumStacks
      ? balanceProfileNumber(elementalEmpowermentProfile, 'attributeConversion')
      : stacks * balanceProfileNumber(elementalEmpowermentProfile, 'coefficientMultiplier')
    : stacks * balanceProfileNumber(elementalEmpowermentProfile, 'attributePerStack');
  // The build may pin the attribute pool the bonus is computed from; otherwise the
  // incoming resolved attributes are used.
  const pool = context.config?.catalystEmpowermentPool as Partial<CatalystEmpowermentPool> | undefined;
  const modified = { ...attributes };

  for (const stat of ['power', 'precision', 'ferocity', 'conditionDamage', 'expertise', 'concentration'] as const) {
    const eligible = Number(pool?.[stat] ?? modified[stat] ?? 0);
    const bonus = eligible * multiplier;
    modified[stat] =
      Number(modified[stat] || 0) + (['power', 'conditionDamage'].includes(stat) ? Math.round(bonus) : bonus);
  }

  return modified;
}

/** Catalyst modifiers: declarative buff-driven damage rules plus the Elemental Empowerment attribute conversion. */
export const catalystModifiers = {
  modifyAttributes: modifyCatalystAttributes,
  modifierRules: catalystModifierRules
};
