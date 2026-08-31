/** Owns the scheduler/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type {
  ScheduledTask,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRecord,
  SimulationEvent
} from '#gw2/platform/engine/types.js';
import type { Gw2CriticalResult } from '#gw2/platform/combat/query/types.js';

export interface Gw2TriggerMaterializer {
  readonly state: SchedulerRecord;
  initialize(context: SchedulerContext): void;
  onEventScheduled(context: SchedulerContext, event: SimulationEvent): void;
  handleTask(context: SchedulerContext, task: ScheduledTask<SchedulerRecord>): void;
  critical(event: SimulationEvent): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export interface Gw2SchedulerPolicy extends SchedulerPolicy {
  critical(context: SchedulerContext, event: SimulationEvent): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}
