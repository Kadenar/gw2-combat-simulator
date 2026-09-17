import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';

export type MesmerVirtuosoExpectedProcCandidate = (
  { readonly type: 'bleeding'; readonly stacks: number } | { readonly type: 'blade'; readonly eventOrder: number }
) &
  SchedulerRecord;
