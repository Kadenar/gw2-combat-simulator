import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';

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
