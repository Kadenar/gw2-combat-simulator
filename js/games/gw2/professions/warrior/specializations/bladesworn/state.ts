import {
  createDragonTriggerState,
  type DragonTriggerState
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger-state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { defineProfessionSpecializationState, cloneStateFields } from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface BladeswornState extends DragonTriggerState {
  flow: ResourceClock;
  /** Each skill window retains its selected grant for resource recovery and observations. */
  flowStabilizerWindows: Array<{
    stacks: number;
    startedAt: number;
    expiresAt: number;
  }>;
  traitPositiveFlowStartedAt: number;
  traitPositiveFlowUntil: number;
  /** Retain the applied trait's stacks so regeneration and its display use the same amount. */
  traitPositiveFlowStacks: number;

  gunsaberActive: boolean;
  tacticalReloadUntil: number;
  overchargedCartridgeWindows: Array<{
    startedAt: number;
    expiresAt: number;
    damageBonus: number;
    burningDuration: number;
    supercharged: boolean;
  }>;
  gunsAndGloryUntil: number;
}

function createBladeswornState(): BladeswornState {
  return {
    flow: createResourceClock(),
    flowStabilizerWindows: [],
    traitPositiveFlowStartedAt: 0,
    traitPositiveFlowUntil: 0,
    traitPositiveFlowStacks: 0,

    gunsaberActive: false,
    ...createDragonTriggerState(),
    tacticalReloadUntil: 0,
    overchargedCartridgeWindows: [],
    gunsAndGloryUntil: 0
  };
}

export const bladeswornState = defineProfessionSpecializationState('Bladesworn', createBladeswornState);

/** The most recent live cartridge occurrence supplies both the strike bonus and Burning payload. */
export function activeCartridgeWindow(
  windows: readonly BladeswornState['overchargedCartridgeWindows'][number][],
  at: number
) {
  for (let index = windows.length - 1; index >= 0; index--) {
    const window = windows[index];

    if (window.startedAt <= at && window.expiresAt > at) return window;
  }

  return undefined;
}

/** Detach only public fields before filtering expiry so private release history is never deep-cloned. */
export function projectBladeswornPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields(bladeswornState.from(input), [
    'flow',
    'flowStabilizerWindows',
    'traitPositiveFlowStartedAt',
    'traitPositiveFlowUntil',
    'traitPositiveFlowStacks',
    'gunsaberActive',
    'dragonTriggerActive',
    'dragonCharges',
    'overchargedCartridgeWindows'
  ]);
  state.overchargedCartridgeWindows = state.overchargedCartridgeWindows.filter(
    (window) => window.expiresAt > input.time
  );
  return {
    [STATE.FLOW]: state.flow,
    [STATE.DRAGON_CHARGES]: state.dragonCharges,
    [STATE.FLOW_STABILIZER_WINDOWS]: state.flowStabilizerWindows,
    [STATE.TRAIT_POSITIVE_FLOW_STARTED_AT]: state.traitPositiveFlowStartedAt,
    [STATE.TRAIT_POSITIVE_FLOW_UNTIL]: state.traitPositiveFlowUntil,
    [STATE.TRAIT_POSITIVE_FLOW_STACKS]: state.traitPositiveFlowStacks,
    [STATE.GUNSABER_ACTIVE]: state.gunsaberActive,
    [STATE.OVERCHARGED_CARTRIDGE_WINDOWS]: state.overchargedCartridgeWindows,
    [STATE.DRAGON_TRIGGER_ACTIVE]: state.dragonTriggerActive
  };
}
