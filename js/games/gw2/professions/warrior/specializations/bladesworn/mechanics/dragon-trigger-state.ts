import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
export interface DragonTriggerState {
  dragonTriggerActive: boolean;
  dragonTriggerStartedAt: number;
  dragonTriggerChargeDeadline: number;
  nextDragonChargeAt: number;
  dragonChargeTickCount: number;
  /** Actual threshold timestamps include Flow stalls and doubled Tactical Reload charge gains. */
  dragonChargeReachedAt: number[];
  dragonCharges: ResourceClock;
  dragonChargesPerInterval: number;
  dragonTriggerFlowSpent: number;
  dragonTriggerEventActivationId: string;
}
/** A fresh state fragment keeps the active charging window and its thresholds isolated between runs. */
export function createDragonTriggerState(): DragonTriggerState {
  return {
    dragonTriggerActive: false,
    dragonTriggerStartedAt: 0,
    dragonTriggerChargeDeadline: 0,
    nextDragonChargeAt: 0,
    dragonChargeTickCount: 0,
    dragonChargeReachedAt: [],
    dragonCharges: createResourceClock(),
    dragonChargesPerInterval: 1,
    dragonTriggerFlowSpent: 0,
    dragonTriggerEventActivationId: ''
  };
}
