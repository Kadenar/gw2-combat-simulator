import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { balanceProfileValueFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { illusionSource, timedActive } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { initializeVirtuosoRuntime } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/runtime.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import type {
  MesmerPrecastContext,
  MesmerSchedulerContext,
  MesmerSchedulerTask
} from '#gw2/professions/mesmer/types.js';

import { deadlyBladesReaction } from '#gw2/professions/mesmer/specializations/virtuoso/traits/deadly-blades.js';
import { VIRTUOSO_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import {
  bloodsongReaction,
  jaggedMindReaction
} from '#gw2/professions/mesmer/specializations/virtuoso/traits/expected-procs.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Requires at least one stocked blade before a Virtuoso bladesong can begin. */
function virtuosoAvailability(context: MesmerPrecastContext, skill: MesmerSkill): AvailabilityResult {
  if (skill.handlerId !== 'mesmer.bladesong' || mesmerRuntimeFor(context).actions.currentResource() >= 1) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.no-blades',
    reason: `${skill.name} requires at least one blade.`
  };
}

export const virtuosoCastRules = Object.freeze({
  availability: {
    id: 'mesmer.virtuoso.availability',
    order: 20,
    handler: virtuosoAvailability
  }
});

/** Applies Virtuoso-only attribute deltas that override shared trait baselines. */
function applyVirtuosoAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const quietIntensityDelta = hasTrait(context, TRAIT.QUIET_INTENSITY)
    ? Number(attributes.vitality || 0) *
      (balanceProfileValueFromContext(context, PROFILE.quietIntensity, 'vitalityConversion', 0.1) - 0.1)
    : 0;
  const sharpeningSorrowDelta = hasTrait(context, PROFILE.sharpeningSorrow)
    ? balanceProfileValueFromContext(context, PROFILE.sharpeningSorrow, 'expertiseBonus', 150) - 150
    : 0;
  if (quietIntensityDelta === 0 && sharpeningSorrowDelta === 0) return attributes;
  return {
    ...attributes,
    ferocity: Number(attributes.ferocity || 0) + quietIntensityDelta,
    expertise: Number(attributes.expertise || 0) + sharpeningSorrowDelta
  };
}

export const virtuosoModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.virtuoso.phantasmal-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => context.event?.summonKind === 'phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
  },
  {
    id: 'mesmer.quiet-intensity-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) =>
      !illusionSource(context) &&
      hasTrait(context, TRAIT.QUIET_INTENSITY) &&
      Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  },
  {
    id: 'mesmer.deadly-blades',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: { strikeBonus: 0.05, conditionBonus: 0.1 },
    amount: (_context, target, parameters) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionBonus : parameters.strikeBonus,
    when: (context) => !illusionSource(context) && timedActive(context, 'deadly-blades')
  },
  {
    id: 'mesmer.infinite-forge',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    order: 100,
    when: (context) => Boolean(context.event?.metadata?.blade) && hasTrait(context, TRAIT.INFINITE_FORGE)
  },
  {
    id: 'mesmer.mental-focus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MENTAL_FOCUS) &&
      Boolean(context.config?.target?.nearby) &&
      isGw2PlayerActorEvent(context.event)
  },
  {
    id: 'mesmer.bloodsong',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) => context.condition === 'Bleeding' && hasTrait(context, TRAIT.BLOODSONG)
  }
]);

export function handleBladeSpendTask(context: MesmerSchedulerContext, task: MesmerSchedulerTask<'bladeSpend'>): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(task.payload.reservationId);
  if (!details || details.shatterSpendCommitted) return;
  details.shatterSpent = runtime.actions.commitReservedResources(task.at, Number(details.shatterSpent || 0), {
    sourceSkill: task.payload.sourceSkill,
    rotationIndex: task.payload.rotationIndex
  });
  details.shatterSpendCommitted = true;
}

export const infiniteForge = timedEffect({
  id: 'mesmer.infinite-forge',
  priority: -20,
  interval: (context: MesmerSchedulerContext) =>
    balanceProfileValueFromContext(context, TRAIT.INFINITE_FORGE, 'pulseInterval', 3),
  effectsAt(context: MesmerSchedulerContext, at: number) {
    const runtime = mesmerRuntimeFor(context);
    runtime.resources.gainResources(
      at,
      balanceProfileValueFromContext(context, TRAIT.INFINITE_FORGE, 'playerStacks', 1),
      runtime.activePrimaryWeapon(),
      'Infinite Forge',
      {
        traitId: TRAIT.INFINITE_FORGE,
        traitName: 'Infinite Forge'
      }
    );
  }
});

export const virtuosoSchedulerHooks = Object.freeze({
  onEventScheduled: Object.freeze([
    deadlyBladesReaction.onEventScheduled,
    bloodsongReaction.onEventScheduled,
    jaggedMindReaction.onEventScheduled
  ]),
  taskHandlers: Object.freeze({
    'mesmer.blade-spend': handleBladeSpendTask,
    ...infiniteForge.taskHandlers,
    ...deadlyBladesReaction.taskHandlers,
    ...bloodsongReaction.taskHandlers,
    ...jaggedMindReaction.taskHandlers
  })
});

export const virtuosoAttributeRules = Object.freeze({
  modifyAttributes: applyVirtuosoAttributes,
  modifierRules: virtuosoModifierRules
});

export const virtuosoRuntimeHooks = Object.freeze({
  ...virtuosoSchedulerHooks,
  initialize: initializeVirtuosoRuntime
});
