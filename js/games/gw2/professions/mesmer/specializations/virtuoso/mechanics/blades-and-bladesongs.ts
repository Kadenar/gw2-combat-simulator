import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
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

/** Apply conversions once and reconcile assumed Fury with the live boon state. */
function applyVirtuosoAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const staticApplied = professionStaticRulesApplied(context.config);
  const quietIntensityDelta =
    hasTrait(context, TRAIT.QUIET_INTENSITY) && !staticApplied
      ? Number(context.config?.stats?.vitality || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.quietIntensity), 'vitalityConversion')
      : 0;
  const sharpeningSorrowDelta = hasTrait(context, PROFILE.sharpeningSorrow)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.sharpeningSorrow), 'expertiseBonus') *
      (Number(boonActive(context, 'fury')) - Number(staticApplied && Boolean(context.config?.boons?.fury)))
    : 0;
  if (quietIntensityDelta === 0 && sharpeningSorrowDelta === 0) return attributes;
  return {
    ...attributes,
    ferocity: Number(attributes.ferocity || 0) + quietIntensityDelta,
    expertise: Number(attributes.expertise || 0) + sharpeningSorrowDelta
  };
}

const virtuosoModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.virtuoso.phantasmal-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'phantasmCriticalChance'),
    when: (context) => context.event?.summonKind === 'phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
  },
  {
    id: 'mesmer.quiet-intensity-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'criticalChance'),
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

function handleBladeSpendTask(context: MesmerSchedulerContext, task: MesmerSchedulerTask<'bladeSpend'>): void {
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
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE), 'pulseInterval'),
  effectsAt(context: MesmerSchedulerContext, at: number) {
    const runtime = mesmerRuntimeFor(context);
    const infiniteForgeProfile = requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE);
    runtime.resources.gainResources(
      at,
      balanceProfileNumber(infiniteForgeProfile, 'playerStacks'),
      runtime.activePrimaryWeapon(),
      'Infinite Forge',
      {
        traitId: TRAIT.INFINITE_FORGE,
        traitName: 'Infinite Forge'
      }
    );
  }
});

const virtuosoSchedulerHooks = Object.freeze({
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
