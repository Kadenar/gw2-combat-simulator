import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { BladeswornState, WarriorConfig } from '#gw2/content/professions/warrior/types.js';

export function createBladeswornState(config: WarriorConfig = {}): BladeswornState {
  return {
    flow: Math.max(0, Math.min(100, Number(config.initialResource ?? 0))),
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
    dragonCharges: 0,
    dragonChargesPerInterval: 1,
    dragonTriggerRotationIndex: -1,
    dragonTriggerFlowSpent: 0,
    dragonTriggerEventActivationId: '',
    tacticalReloadUntil: 0,
    overchargedCartridgeWindows: [],
    fierceAsFireExpiries: [],
    gunsAndGloryUntil: 0,
    ammoRoundsSpentByActivation: {},
    ammoStartedFullByActivation: {},
    dragonAdrenalineSpentByActivation: {}
  };
}

export const bladeswornState = defineProfessionSpecializationState('Bladesworn', createBladeswornState);
