import { canonicalTime } from '#kernel/core/clock.js';
import { HandlerRegistry } from '#gw2/platform/engine/resolution/handler-registry.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { normalizeBoonDuration } from '#gw2/platform/combat/boons.js';

import type {
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverHandlerRegistry
} from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

interface CreateGw2ResolverHandlerRegistryOptions {
  readonly commonHandlers?: Gw2ResolverEventHandlers;
  readonly professionHandlers?: Gw2ResolverEventHandlers;
}

export const GW2_RESOLVER_PHASE = Object.freeze({ Sample: 0, Settle: 1, Ordinary: 2 });

/** Settlement reactions expose state before strikes, while direct attacks and future work retain their own phase. */
export function gw2ResolverPhase(
  event: Gw2ResolverEvent,
  current: Readonly<{ at: number; phase: number }> | null
): number {
  if (event.type === 'condition_buffer') return GW2_RESOLVER_PHASE.Sample;
  if (event.type === 'condition_tick') return GW2_RESOLVER_PHASE.Settle;
  if (event.type !== 'damage' && current?.at === event.at && current.phase === GW2_RESOLVER_PHASE.Settle) {
    return GW2_RESOLVER_PHASE.Settle;
  }

  return GW2_RESOLVER_PHASE.Ordinary;
}

export function createGw2ResolverHandlerRegistry({
  commonHandlers = {},
  professionHandlers = {}
}: CreateGw2ResolverHandlerRegistryOptions = {}): Gw2ResolverHandlerRegistry {
  const registry = new HandlerRegistry<Gw2ResolverRuntime, Gw2ResolverEvent>();
  return registry.registerAll(commonHandlers).registerAll(professionHandlers);
}

function targetHealth(ctx: Gw2ResolverRuntime): number {
  const value = Number(ctx.config.target?.health ?? 0);
  return value > 0 ? value : Infinity;
}

/**
 * Events suppressed before an explicit Combat Start: outgoing damage ticks
 * plus target vulnerability, which scales that output. Condition applications
 * still process so their unexpired stacks can carry across the combat boundary;
 * their precombat ticks remain gated.
 */
function isCombatGatedEvent(event: Gw2ResolverEvent): boolean {
  return (
    event.type === 'damage' ||
    event.type === 'condition_tick' ||
    event.type === 'combo_finisher' ||
    event.comboId != null
  );
}

/**
 * Uses the canonical activation id when present. Legacy/resolver-generated
 * multi-hit packets can still prove sibling ownership from their hit metadata.
 */
function combatActivationKey(event: Gw2ResolverEvent): string | null {
  if (typeof event.activationId === 'string' && event.activationId) {
    return `id:${event.activationId}`;
  }

  const hitIndex = Math.trunc(Number(event.hitIndex));
  const totalHits = Math.trunc(Number(event.totalHits));
  if (totalHits <= 1 || hitIndex < 1 || hitIndex > totalHits) return null;
  return [
    'multi-hit',
    event.at,
    event.actorType || 'unknown',
    event.sourceId,
    event.skillId,
    event.skillName || '',
    totalHits
  ].join('|');
}

/**
 * Drains a GW2 resolver queue with shared time ordering, target eligibility,
 * encounter bounds, combat start, target death, and handler dispatch.
 */
export function runGw2ResolverEventLoop(
  ctx: Gw2ResolverRuntime,
  handlerRegistry: Gw2ResolverHandlerRegistry,
  resolvedTimelineEvents?: Gw2ResolverEvent[]
): void {
  if (!handlerRegistry) {
    throw new TypeError('GW2 resolver event loop requires a handler registry.');
  }

  const queue = ctx.queue;
  const hp = targetHealth(ctx);
  // Infinity is the internal unbounded-horizon sentinel, never an authored timestamp.
  const horizon = ctx.horizon === Infinity ? Infinity : canonicalTime(ctx.horizon);
  const combatStart = ctx.combatStartTime == null ? null : canonicalTime(ctx.combatStartTime);
  let lethalActivationKey: string | null = null;
  // A zero-health start is already lethal and must not grant a free opening hit.
  if (targetHealthLoss(ctx.config, ctx) >= hp) ctx.deathTime = 0;
  // The runtime queue maintains chronological and causal placement as handlers enqueue derived events.
  while (queue.length > 0) {
    const queuedEvent = queue.dequeue();
    if (!queuedEvent) break;
    // Derived resolver grants bypass scheduler emission; apply the same final-duration contract before handlers run.
    const event = normalizeBoonDuration(queuedEvent);
    if (event.at > horizon) break;
    if (ctx.deathTime != null) {
      if (event.at > ctx.deathTime) break;
      // Finish the lethal activation and simultaneous condition-tick batch,
      // but reject a distinct attack ordered after the target already died.
      if (
        isCombatGatedEvent(event) &&
        event.type !== 'condition_tick' &&
        (lethalActivationKey == null || combatActivationKey(event) !== lethalActivationKey)
      )
        continue;
    }

    if (missesTarget(event)) continue;
    // Recurring condition wakes must advance their clock even when their damage is gated before combat.
    if (combatStart != null && event.at < combatStart && isCombatGatedEvent(event) && !event.conditionGroup) continue;

    if (handlerRegistry.has(event.type)) {
      handlerRegistry.dispatch(event, ctx);
    } else if (String(event.type).includes('.')) {
      throw new Error(`No event handler registered for required type: ${event.type}`);
    }

    // Publish queryable state only after execution, so samples and earlier strikes cannot see pending ordinary work.
    if (['action', 'cooldown_snapshot', 'weapon_set', 'buff', 'boon_extension', 'marker'].includes(event.type)) {
      resolvedTimelineEvents?.push(event);
    }

    if (ctx.deathTime == null && targetHealthLoss(ctx.config, ctx) >= hp) {
      ctx.deathTime = event.at;
      lethalActivationKey = combatActivationKey(event);
    }
  }
}
