import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
/** Core critical traits share player-hit eligibility while keeping separate accumulation and ICD state. */
export function criticalTraitEligible(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails,
  traitId: number
): boolean {
  return (
    hasTrait(context, traitId) &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    details.hitContext?.critEligible === true
  );
}

import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import {
  applyElementalistDerivedCondition,
  queueElementalistBuff,
  recordElementalistTraitProc
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';

import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Materializes Raging Storm after its registered critical-hit reaction succeeds. */
function applyRagingStorm(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const ragingStormProfile = requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM);
  const fury = requireEffect(ragingStormProfile, 'boon', 'Fury');
  if (fury) {
    queueElementalistBuff(context, event, String(fury.boon), Number(fury.stacks), fury.duration, 'Raging Storm');
  }
}

/** Only an accepted player critical hit can reset Air's actual recharge. */
export function applyFreshAirCritical(
  context: ElementalistRuntime,
  event: Gw2ResolverEvent,
  critical: { chance: number; didCrit?: boolean }
): void {
  if (
    !hasTrait(context, TRAIT.FRESH_AIR) ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    context.profession.core.primaryAttunement === 'Air' ||
    !critical.didCrit
  )
    return;
  if ((context.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air) ?? 0) > event.at)
    setElementalistAttunementReadyAt(context, 'Air', event.at);
  context.emitDerived(event, {
    type: 'elementalist.fresh-air',
    at: event.at,
    source: 'Fresh Air',
    sourceId: 'Fresh Air',
    actorType: 'effect',
    skillName: 'Fresh Air',
    sourceSkill: event.skillName
  });
}

/** Pending damage supplies a wake, never a predicted resource or critical result. */
export function projectedFreshAirReadyAt(context: ElementalistRuntime, upTo: number): number | null {
  if (!hasTrait(context, TRAIT.FRESH_AIR)) return null;
  const core = context.profession.core;
  if (core.primaryAttunement === 'Air') return null;
  // Readiness queries ignore elapsed wakes without pruning the live scheduler's candidates.
  const times = core.freshAirCandidates.filter((at) => at > context.time && at <= upTo);
  return times.length ? Math.min(...times) : null;
}

/** Only Fresh Air records future player strike wakes; this never predicts their critical result. */
export function observeFreshAirCandidate(runtime: ElementalistRuntime, event: SimulationEventBase): void {
  if (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    canonicalTime(event.at) > runtime.time &&
    hasTrait(runtime, TRAIT.FRESH_AIR)
  ) {
    // Only Fresh Air needs strike wakes; retire elapsed times as new work arrives.
    const core = runtime.profession.core;
    core.freshAirCandidates = core.freshAirCandidates.filter((at) => at > runtime.time);
    core.freshAirCandidates.push(canonicalTime(event.at));
  }
}

/** Keep ragingStorm's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const ragingStormCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.raging-storm',
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.RAGING_STORM),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM), 'internalCooldown'),
    readyAt: (context) => context.procs.readyAt.ragingStorm || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.readyAt.ragingStorm = readyAt;
    }
  },
  handler: applyRagingStorm
});

/** Materializes Arcane Precision after its registered critical-hit reaction succeeds. */
function applyArcanePrecision(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const attunement = professionCoreState(context).primaryAttunement;
  const arcanePrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION);
  const condition = requireEffect(arcanePrecisionProfile, 'condition', attunement);

  if (condition) {
    applyElementalistDerivedCondition(context, event, {
      source: 'Arcane Precision',
      sourceId: TRAIT.ARCANE_PRECISION,
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    });

    recordElementalistTraitProc(context, event, 'Arcane Precision');
  }
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
function applyRenewingStamina(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const renewingStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA);
  const vigor = requireEffect(renewingStaminaProfile, 'boon', 'Vigor');
  if (vigor) {
    queueElementalistBuff(context, event, String(vigor.boon), Number(vigor.stacks), vigor.duration, 'Renewing Stamina');
  }
}

/** Keep arcanePrecision's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const arcanePrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.arcane-precision',
  chanceOnCriticalHit: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'procChance'),
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.ARCANE_PRECISION),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.readyAt.arcanePrecision || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.readyAt.arcanePrecision = readyAt;
    }
  },
  randomStream: 'elementalist.arcane-precision',
  handler: applyArcanePrecision
});

/** Keep renewingStamina's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const renewingStaminaCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.renewing-stamina',
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.RENEWING_STAMINA),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA), 'internalCooldown'),
    readyAt: (context) => context.procs.readyAt.renewingStamina || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.readyAt.renewingStamina = readyAt;
    }
  },
  handler: applyRenewingStamina
});

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
function applyBurningPrecision(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const burningPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION);
  const burning = requireEffect(burningPrecisionProfile, 'condition', 'Burning Precision');
  if (burning) {
    applyElementalistDerivedCondition(context, event, {
      source: 'Burning Precision',
      procCount: 1,
      sourceId: TRAIT.BURNING_PRECISION,
      condition: String(burning.condition),
      stacks: Number(burning.stacks),
      duration: Number(burning.duration)
    });

    recordElementalistTraitProc(context, event, 'Burning Precision');
  }
}

/** Keep burningPrecision's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const burningPrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.burning-precision',
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BURNING_PRECISION),
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.BURNING_PRECISION),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.readyAt.burningPrecision || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.readyAt.burningPrecision = readyAt;
    }
  },
  randomStream: 'elementalist.burning-precision',
  handler: applyBurningPrecision
});
