import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

function paragonRuntimeState(context: Gw2ModifierContext): {
  motivation?: number;
  activeRefrainId?: number | string | null;
} {
  return (
    readProfessionSpecializationState<{ motivation?: number; activeRefrainId?: number | string | null }>(
      context.runtime?.profession,
      'Paragon'
    ) || {}
  );
}

function motivation(context: Gw2ModifierContext): number {
  return Number(paragonRuntimeState(context).motivation || 0);
}

// Resolve Brisk Pacing's modifier amount from live Motivation and refrain state
// at the queried event timestamp.
function briskPacingAmount(
  context: Gw2ModifierContext,
  target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const current = motivation(context);
  if (current <= 0) return 0;
  const strike =
    current >= parameters.highThreshold
      ? parameters.strikeHigh
      : current >= parameters.middleThreshold
        ? parameters.strikeMiddle
        : parameters.strikeLow;
  const condition =
    current >= parameters.highThreshold
      ? parameters.conditionHigh
      : current >= parameters.middleThreshold
        ? parameters.conditionMiddle
        : parameters.conditionLow;
  return target === MODIFIER_TARGET.CONDITION_DAMAGE ? condition : strike;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.strengthening-stanzas',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      strikeBonus: 0.15,
      conditionBonus: 0.1
    } as Readonly<Record<string, number>>,
    amount: (_context, target, parameters) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionBonus : parameters.strikeBonus,
    when: (context) =>
      hasTrait(context, TRAIT.STRENGTHENING_STANZAS) &&
      paragonRuntimeState(context).activeRefrainId === ID.CHANT_OF_ACTION
  },
  {
    id: 'warrior.brisk-pacing',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      middleThreshold: 4,
      highThreshold: 7,
      strikeLow: 0.1,
      strikeMiddle: 0.2,
      strikeHigh: 0.3,
      conditionLow: 0.05,
      conditionMiddle: 0.15,
      conditionHigh: 0.25
    } as Readonly<Record<string, number>>,
    amount: briskPacingAmount,
    when: (context) => hasTrait(context, TRAIT.BRISK_PACING) && motivation(context) > 0
  }
]);

function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  // Skip when attributes have already been pre-computed in the static pass to
  // prevent the concentration bonus from being applied twice.
  if (!hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) || professionStaticRulesApplied(context.config)) {
    return attributes;
  }

  const inspiringImplementsProfile = requireBalanceProfileFromContext(context, PROFILE.inspiringImplements);
  return {
    ...attributes,
    concentration:
      Number(attributes.concentration || 0) + balanceProfileNumber(inspiringImplementsProfile, 'attributeBonus')
  };
}

export const paragonModifiers = Object.freeze({
  modifyAttributes,
  modifierRules
});
