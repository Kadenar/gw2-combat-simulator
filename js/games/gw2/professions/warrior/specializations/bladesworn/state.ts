import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface BladeswornState {
  flow: number;
  maximumFlow: number;
  flowUpdatedAt: number;
  flowStabilizerWindows: Array<{
    startedAt: number;
    expiresAt: number;
  }>;
  traitPositiveFlowStartedAt: number;
  traitPositiveFlowUntil: number;
  gunsaberSwapTraitReadyAt: number;
  gunsaberActive: boolean;
  dragonTriggerActive: boolean;
  dragonTriggerStartedAt: number;
  dragonTriggerChargeDeadline: number;
  nextDragonChargeAt: number;
  dragonChargeTickCount: number;
  dragonCharges: number;
  dragonChargesPerInterval: number;
  dragonTriggerRotationIndex: number;
  dragonTriggerFlowSpent: number;
  dragonTriggerEventActivationId: string;
  tacticalReloadUntil: number;
  overchargedCartridgeWindows: Array<{
    startedAt: number;
    expiresAt: number;
    damageBonus: number;
    burningDuration: number;
    supercharged: boolean;
  }>;
  gunsAndGloryUntil: number;
  ammoRoundsSpentByActivation: Record<string, number>;
  ammoStartedFullByActivation: Record<string, boolean>;
  dragonAdrenalineSpentByActivation: Record<string, number>;
}

/** Declares Bladesworn's public compatibility fields and inactive values. */
export const BLADESWORN_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  flow: 0,
  maximumFlow: 100,
  flowStabilizerWindows: [],
  traitPositiveFlowStartedAt: 0,
  traitPositiveFlowUntil: 0,
  gunsaberActive: false,
  dragonTriggerActive: false,
  dragonCharges: 0,
  overchargedCartridgeWindows: []
} satisfies Partial<BladeswornState>);

export function createBladeswornState(config: Gw2Config = {}): BladeswornState {
  return {
    flow: boundedNumber(config.initialResource ?? 0, 0, 0, 100),
    maximumFlow: 100,
    flowUpdatedAt: 0,
    flowStabilizerWindows: [],
    traitPositiveFlowStartedAt: 0,
    traitPositiveFlowUntil: 0,
    gunsaberSwapTraitReadyAt: 0,
    gunsaberActive: false,
    dragonTriggerActive: false,
    dragonTriggerStartedAt: 0,
    dragonTriggerChargeDeadline: 0,
    nextDragonChargeAt: 0,
    dragonChargeTickCount: 0,
    dragonCharges: 0,
    dragonChargesPerInterval: 1,
    dragonTriggerRotationIndex: -1,
    dragonTriggerFlowSpent: 0,
    dragonTriggerEventActivationId: '',
    tacticalReloadUntil: 0,
    overchargedCartridgeWindows: [],
    gunsAndGloryUntil: 0,
    ammoRoundsSpentByActivation: {},
    ammoStartedFullByActivation: {},
    dragonAdrenalineSpentByActivation: {}
  };
}

export const bladeswornState = defineProfessionSpecializationState('Bladesworn', createBladeswornState);
