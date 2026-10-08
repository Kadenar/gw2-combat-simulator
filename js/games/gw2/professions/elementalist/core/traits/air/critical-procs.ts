import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
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
