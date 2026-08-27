import type { SchedulerContext, SimulationEvent } from '../engine/types.js';
import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication,
  type CriticalProcRequest,
  type CriticalProcState
} from '../combat/critical-procs.js';
import { FOOD_DATA } from '../equipment/consumables/food.js';
import { isGw2PlayerActorEvent } from '../combat/state/event-ownership.js';
import { consumeExpectedCriticalProgress } from '../combat/numeric.js';
import type { Gw2Config } from '../simulation/config.js';
import type { MaterializerState } from './materializer-state.js';
import type { Gw2SchedulerPolicy } from './types.js';

export type ScheduledCriticalProcRequest = Omit<CriticalProcRequest, 'at' | 'stochastic' | 'roll'>;

/**
 * Adapts a canonical scheduler damage event to the phase-neutral critical-proc
 * kernel, including the shared sampled fact and the scheduler's RNG stream.
 */
export function advanceScheduledCriticalProc<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  event: SimulationEvent,
  request: ScheduledCriticalProcRequest,
  state?: CriticalProcState,
  opportunities = 1
): CriticalProcApplication | null {
  const policy = context.schedulerPolicy as unknown as Gw2SchedulerPolicy;
  const chance = Number(policy.critical(context as SchedulerContext, event)?.chance || 0);
  const stochastic =
    (context.config as { readonly randomness?: { readonly mode?: string } }).randomness?.mode === 'stochastic';

  return advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined, opportunities),
    {
      ...request,
      at: event.at,
      stochastic,
      roll: (rollChance, stream) => policy.rollRandom(rollChance, stream)
    },
    state
  );
}

export function hasStochasticCriticalFood(config: Gw2Config): boolean {
  return config.randomness?.mode === 'stochastic' && FOOD_DATA[String(config.food || '')]?.proc?.type === 'critStrike';
}

/**
 * Resolves the critical-strike fact shared by scheduler and resolver consumers.
 *
 * Only coefficient-bearing damage events are considered, and work is skipped
 * unless some configured mechanic requested critical facts. The current
 * critical chance is queried once for the event so every consumer observes the
 * same combat state.
 *
 * In stochastic mode, one actor-scoped roll is stored as `didCrit` on the
 * canonical event. Resolver reactions and critical-triggered equipment then
 * consume that stored result instead of rerolling the hit.
 *
 * In deterministic mode, eligible critical-sigil hits add their critical
 * chance to a scheduler-side prediction accumulator. Crossing one emits a
 * synthetic critical cause and retains the fractional remainder, producing a
 * stable low-discrepancy sequence without random rolls. Resolver-owned sigils
 * maintain separate causal progress from surviving damage packets. The
 * original event is returned because deterministic strikes do not receive a
 * binary `didCrit` result.
 *
 * This function only establishes whether the hit is a critical-sigil cause. It
 * does not check the active weapon set or individual sigil cooldowns; the sigil
 * proc engine applies those constraints after receiving the returned cause.
 *
 * @returns The causal damage event when a critical-sigil trigger occurred, or
 * `null` when the event was ineligible or did not produce a critical trigger.
 */
export function resolveCriticalTrigger(
  context: SchedulerContext,
  event: SimulationEvent,
  state: MaterializerState
): SimulationEvent | null {
  // Ignore non-strikes and skip critical work when no consumer requested it.
  if (!(Number(event.coefficient) > 0) || !state.criticalFactsRequired) {
    return null;
  }

  // Player strikes qualify by default; derived effects must explicitly opt in.
  const canTriggerSigils = isGw2PlayerActorEvent(event) || event.canTriggerCriticalSigils === true;

  // Evaluate critical chance against combat state at the hit's timestamp.
  const critical = state.query!.critical(event, event.at, state);

  // Stochastic mode creates one binary outcome shared by every consumer.
  if (state.random.stochastic) {
    const didCrit = state.random.roll(critical.chance, `critical:${String(event.actorType || 'player')}`);

    // Persist the result on the canonical event for resolver reactions.
    const canonicalEvent = context.eventByOrder(Number(event.__order)) || event;
    const cause = context.replaceEvent(canonicalEvent, { didCrit });

    // Only an eligible actual crit can trigger critical sigils.
    return didCrit && canTriggerSigils ? cause : null;
  }

  // Deterministic progress requires an eligible hit with a possible crit.
  if (!canTriggerSigils || !(critical.chance > 0)) return null;

  return consumeExpectedCriticalProgress(state.sigil, critical.chance) ? event : null;
}
