import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
/** Core critical traits share player-hit eligibility while keeping separate accumulation and ICD state. */
export function criticalTraitEligible(
  context: MechanicCombatContext,
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

import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';

import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';

import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Materializes Raging Storm after its registered critical-hit reaction succeeds. */
function applyRagingStorm(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const ragingStormProfile = requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM);
  const fury = requireEffect(ragingStormProfile, 'boon', 'Fury');
  if (fury) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.RAGING_STORM,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.RAGING_STORM).name,
        kind: String(fury.boon).toLowerCase(),
        stacks: Number(fury.stacks),
        duration: fury.duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
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
  if ((context.cooldownController.readyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air) ?? 0) > event.at)
    setElementalistAttunementReadyAt(context, 'Air', event.at);
  context.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      type: 'elementalist.fresh-air',
      at: event.at,
      source: 'Fresh Air',
      sourceId: 'Fresh Air',
      actorType: 'effect',
      skillName: 'Fresh Air',
      sourceSkill: event.skillName
    }
  });
}

/** Pending damage supplies a wake, never a predicted resource or critical result. */
export function projectedFreshAirReadyAt(context: MechanicQueriesOf<ElementalistRuntime>, upTo: number): number | null {
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
    readyAt: (context) => context.procs.deadline('ragingStorm') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('ragingStorm', readyAt);
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
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Arcane Precision',
        sourceId: TRAIT.ARCANE_PRECISION,
        actorType: 'player',
        skillName: 'Arcane Precision',
        condition: String(condition.condition),
        stacks: Number(condition.stacks),
        duration: Number(condition.duration),
        triggeredBy: resolverSourceSkill(event)
      }
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Arcane Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
function applyRenewingStamina(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const renewingStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA);
  const vigor = requireEffect(renewingStaminaProfile, 'boon', 'Vigor');
  if (vigor) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.RENEWING_STAMINA,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA).name,
        kind: String(vigor.boon).toLowerCase(),
        stacks: Number(vigor.stacks),
        duration: vigor.duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
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
    readyAt: (context) => context.procs.deadline('arcanePrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('arcanePrecision', readyAt);
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
    readyAt: (context) => context.procs.deadline('renewingStamina') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('renewingStamina', readyAt);
    }
  },
  handler: applyRenewingStamina
});

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
function applyBurningPrecision(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const burningPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION);
  const burning = requireEffect(burningPrecisionProfile, 'condition', 'Burning Precision');
  if (burning) {
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Burning Precision',
        sourceId: TRAIT.BURNING_PRECISION,
        actorType: 'player',
        skillName: 'Burning Precision',
        condition: String(burning.condition),
        stacks: Number(burning.stacks),
        duration: Number(burning.duration),
        triggeredBy: resolverSourceSkill(event),
        metadata: { procCount: 1 }
      }
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Burning Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
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
    readyAt: (context) => context.procs.deadline('burningPrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('burningPrecision', readyAt);
    }
  },
  randomStream: 'elementalist.burning-precision',
  handler: applyBurningPrecision
});
