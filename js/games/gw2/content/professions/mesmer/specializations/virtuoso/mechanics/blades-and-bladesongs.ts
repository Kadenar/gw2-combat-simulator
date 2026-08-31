import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedActive } from '#gw2/content/professions/mesmer/core/traits/modifiers.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { initializeVirtuosoRuntime } from '#gw2/content/professions/mesmer/specializations/virtuoso/mechanics/runtime.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';
import type { MesmerSchedulerContext, MesmerSchedulerTask } from '#gw2/content/professions/mesmer/types.js';
import { mesmerBalanceValue } from '#gw2/content/professions/mesmer/core/profiles.js';
import {
  handleDeadlyBladesCriticalTask,
  observeDeadlyBladesEvent
} from '#gw2/content/professions/mesmer/specializations/virtuoso/traits/deadly-blades.js';
import { VIRTUOSO_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/specializations/virtuoso/profiles.js';
import {
  handleVirtuosoExpectedProcTask,
  observeVirtuosoExpectedProcEvent
} from '#gw2/content/professions/mesmer/specializations/virtuoso/traits/expected-procs.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type { MesmerPrecastContext, MesmerSkill } from '#gw2/content/professions/mesmer/types.js';

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
      (mesmerBalanceValue(context, PROFILE.quietIntensity, 'vitalityConversion', 0.1) - 0.1)
    : 0;
  const sharpeningSorrowDelta = hasTrait(context, PROFILE.sharpeningSorrow)
    ? mesmerBalanceValue(context, PROFILE.sharpeningSorrow, 'expertiseBonus', 150) - 150
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
    when: (context) => context.event?.source === 'Phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
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
    when: (context) => Boolean(context.event?.blade) && hasTrait(context, TRAIT.INFINITE_FORGE)
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
      context.event?.source === 'Player'
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

export function handleInfiniteForgeTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'infiniteForge'>
): void {
  const runtime = mesmerRuntimeFor(context);
  runtime.resources.gainResources(
    task.at,
    mesmerBalanceValue(context, TRAIT.INFINITE_FORGE, 'playerStacks', 1),
    runtime.activePrimaryWeapon(),
    'Infinite Forge',
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: 'Infinite Forge'
    }
  );
  context.tasks.schedule({
    type: 'mesmer.infinite-forge',
    at: task.at + mesmerBalanceValue(context, TRAIT.INFINITE_FORGE, 'pulseInterval', 3),
    priority: -20,
    ownerId: 'mesmer.infinite-forge',
    payload: {}
  });
}

export const virtuosoSchedulerHooks = Object.freeze({
  onEventScheduled: Object.freeze([
    {
      id: 'mesmer.virtuoso.deadly-blades',
      order: 20,
      handler: observeDeadlyBladesEvent
    },
    {
      id: 'mesmer.virtuoso.expected-procs',
      order: 30,
      handler: observeVirtuosoExpectedProcEvent
    }
  ]),
  taskHandlers: Object.freeze({
    'mesmer.blade-spend': handleBladeSpendTask,
    'mesmer.infinite-forge': handleInfiniteForgeTask,
    'mesmer.deadly-blades-critical': handleDeadlyBladesCriticalTask,
    'mesmer.virtuoso-expected-proc': handleVirtuosoExpectedProcTask
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
