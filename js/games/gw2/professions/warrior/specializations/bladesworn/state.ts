import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { BladeswornState, WarriorConfig } from '#gw2/professions/warrior/types.js';

/** Declares Bladesworn's public compatibility fields and inactive values. */
export const BLADESWORN_PUBLIC_END_STATE_KEYS = Object.freeze([
  'flow',
  'maximumFlow',
  'flowStabilizerWindows',
  'traitPositiveFlowStartedAt',
  'traitPositiveFlowUntil',
  'gunsaberActive',
  'dragonTriggerActive',
  'dragonCharges',
  'overchargedCartridgeWindows'
] as const satisfies readonly (keyof BladeswornState)[]);

export const BLADESWORN_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<BladeswornState>> = Object.freeze({
  flow: 0,
  maximumFlow: 100,
  flowStabilizerWindows: [],
  traitPositiveFlowStartedAt: 0,
  traitPositiveFlowUntil: 0,
  gunsaberActive: false,
  dragonTriggerActive: false,
  dragonCharges: 0,
  overchargedCartridgeWindows: []
});

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
