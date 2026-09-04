import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';

export interface MesmerVirtuosoState {
  numericResource: number;
  nextForgeAt: number;
  bloodsongProgress: number;
}

export type MesmerVirtuosoExpectedProcCandidate = (
  | { readonly type: 'bleeding'; readonly at: number; readonly stacks: number }
  | { readonly type: 'blade'; readonly at: number; readonly event: SimulationEvent }
) &
  SchedulerRecord;
