import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { syncWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import {
  advanceParagon,
  applyParagonWeaponSwapTraits,
  beginParagonCast,
  handleParagonCommandEchoTask,
  observeParagonEvent,
  updateParagonCast
} from '#gw2/professions/warrior/specializations/paragon/traits/index.js';

export const paragonSchedulerHooks = Object.freeze({
  // Paragon adds its specialization trait without owning the base swap.
  onWeaponSwap: applyParagonWeaponSwapTraits,
  initialize: (context: WarriorSchedulerContext) => {
    const state = paragonState.from(context);
    state.maximumMotivation = Number(balanceProfileFromContext(context, PROFILE.resources)?.maximumStacks ?? 10);
    state.motivation = Math.min(state.maximumMotivation, state.motivation);
    professionCoreState(context).maximumAdrenaline = 10;
    syncWarriorAdrenaline(context);
  },
  onCastStart: beginParagonCast,
  advance: {
    id: 'warrior.paragon-refrain',
    order: 20,
    handler: advanceParagon
  },
  afterCast: {
    id: 'warrior.paragon-motivation',
    order: 20,
    handler: updateParagonCast
  },
  onEventScheduled: {
    id: 'warrior.paragon-call-to-action',
    order: 20,
    handler: observeParagonEvent
  },
  taskHandlers: Object.freeze({
    'warrior.paragon-command-echo': handleParagonCommandEchoTask
  })
});

function paragonRuntimeState(context: Gw2ModifierContext): {
  motivation?: number;
  activeRefrain?: string;
} {
  return (
    readProfessionSpecializationState<{ motivation?: number; activeRefrain?: string }>(
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
      hasTrait(context, TRAIT.STRENGTHENING_STANZAS) && paragonRuntimeState(context).activeRefrain === 'Chant of Action'
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

function modifyAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  // Skip when attributes have already been pre-computed in the static pass to
  // prevent the concentration bonus from being applied twice.
  if (!hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) || professionStaticRulesApplied(context.config)) {
    return attributes;
  }

  return {
    ...attributes,
    concentration:
      Number(attributes.concentration || 0) +
      Number(balanceProfileFromContext(context, PROFILE.inspiringImplements)?.attributeBonus ?? 180)
  };
}

export const paragonAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules
});
