import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
/** Immutable release facts remain available after charging state exits. */
interface DragonSlashRelease {
  readonly charges: number;
  readonly maximum: number;
  readonly flowSpent: number;
  readonly coefficient: number;
}
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
  dragonSlashReleases: Map<string, DragonSlashRelease>;
}
/** A fresh state fragment keeps thresholds and accepted release facts isolated between runs. */
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
    dragonTriggerEventActivationId: '',
    dragonSlashReleases: new Map()
  };
}
