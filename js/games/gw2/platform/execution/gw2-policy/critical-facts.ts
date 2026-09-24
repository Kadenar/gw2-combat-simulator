import type { SchedulerContext } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2CriticalResult } from '#gw2/platform/combat/query/combat-query.js';
import {
  advanceCriticalProc,
  criticalOpportunity,
  type CriticalProcApplication,
  type CriticalProcRequest,
  type CriticalProcState
} from '#gw2/platform/combat/critical-procs.js';
import { FOOD_DATA } from '#gw2/platform/equipment/consumables/food.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { MaterializerState } from '#gw2/platform/execution/gw2-policy/materializer-state.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';

export type ScheduledCriticalProcRequest = Omit<CriticalProcRequest, 'at' | 'roll'>;

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
  // Replacements can cancel a queued hit before its critical task executes.
  if (event.type !== 'damage' || event.cancelled === true || missesTarget(event)) return null;
  // A rejected precombat hit cannot crit or advance a profession's hit-dependent state.
  if (context.hasExplicitCombatStart && (context.combatStartTime == null || event.at < context.combatStartTime))
    return null;
  const policy = context.schedulerPolicy as unknown as Gw2SchedulerPolicy;
  const chance = Number(policy.critical(context, event)?.chance || 0);

  return advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined, opportunities),
    {
      ...request,
      at: event.at,
      roll: (rollChance, stream) => policy.rollRandom(rollChance, stream)
    },
    state
  );
}

export function hasCriticalFood(config: Gw2Config): boolean {
  return FOOD_DATA[String(config.food || '')]?.proc?.type === 'critStrike';
}

/** Sample once for every critical consumer, independently of equipped sigils and their cooldowns. */
export function sampleScheduledCritical(
  context: SchedulerContext,
  event: SimulationEvent,
  state: MaterializerState,
  observedCritical?: Gw2CriticalResult
): SimulationEvent {
  if (!(Number(event.coefficient) > 0) || !state.criticalFactsRequired) return event;
  const critical = observedCritical ?? state.query!.critical(event, event.at, state);
  const didCrit = state.random.roll(critical.chance, `critical:${String(event.actorType || 'player')}`);
  return context.replaceEvent(event, { didCrit });
}
