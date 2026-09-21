/** Owns the scheduler/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { ScheduledTask, SchedulerContext, SchedulerPolicy } from '#gw2/platform/execution/types.js';
import type { MaterializerState } from '#gw2/platform/execution/gw2-policy/materializer-state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2CriticalResult } from '#gw2/platform/combat/query/combat-query.js';

/** Defers one scheduled event's materialization until its task runs. */
export interface MaterializeEventTaskPayload {
  readonly eventOrder: number;
}

export interface Gw2TriggerMaterializer {
  readonly state: MaterializerState;
  initialize(context: SchedulerContext): void;
  onEventScheduled(context: SchedulerContext, event: SimulationEvent): void;
  onEventReplaced(previous: SimulationEvent, replacement: SimulationEvent): void;
  handleTask(context: SchedulerContext, task: ScheduledTask<MaterializeEventTaskPayload>): void;
  critical(event: SimulationEvent): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export interface Gw2SchedulerPolicy extends SchedulerPolicy {
  critical<TProfessionState extends object>(
    context: SchedulerContext<TProfessionState>,
    event: SimulationEvent
  ): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  targetHasCondition(condition: string, time: number): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}
