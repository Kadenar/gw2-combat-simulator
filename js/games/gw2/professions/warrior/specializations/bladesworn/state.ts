import { buffDeadlineActive, buffWindowActive } from '#gw2/platform/combat/buff-expiry.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import {
  createDragonTriggerState,
  type DragonTriggerState
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger-state.js';
import type { PositiveFlowGrant } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import { createResourceClock, type ResourceClock } from '#kernel/resources/accrual.js';

export interface BladeswornState extends DragonTriggerState {
  flow: ResourceClock;
  positiveFlow: PositiveFlowGrant[];

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
    positiveFlow: [],

    gunsaberActive: false,
    ...createDragonTriggerState(),
    tacticalReloadUntil: 0,
    overchargedCartridgeWindows: [],
    gunsAndGloryUntil: 0
  };
}

export const bladeswornState = defineProfessionSpecializationState('Bladesworn', createBladeswornState);

/** Observers need grant times and counts. Only the Flow module uses the source to refresh a grant. */
export function positiveFlowWindows(state: BladeswornState) {
  return state.positiveFlow.map(({ startedAt, expiresAt, stacks }) => ({ startedAt, expiresAt, stacks }));
}

/** The most recent live cartridge occurrence supplies both the strike bonus and Burning payload. */
export function activeCartridgeWindow(
  windows: readonly BladeswornState['overchargedCartridgeWindows'][number][],
  at: number
) {
  for (let index = windows.length - 1; index >= 0; index--) {
    const window = windows[index];

    if (buffWindowActive(at, window.startedAt, window.expiresAt)) return window;
  }

  return undefined;
}

/** Filter public expiry windows without altering live state or reading private release history. */
export function projectBladeswornPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = bladeswornState.from(input.profession);
  return {
    [STATE.FLOW]: state.flow,
    [STATE.DRAGON_CHARGES]: state.dragonCharges,
    [STATE.POSITIVE_FLOW_WINDOWS]: positiveFlowWindows(state),
    [STATE.GUNSABER_ACTIVE]: state.gunsaberActive,
    [STATE.OVERCHARGED_CARTRIDGE_WINDOWS]: state.overchargedCartridgeWindows.filter((window) =>
      buffDeadlineActive(window.expiresAt, input.time)
    ),
    [STATE.DRAGON_TRIGGER_ACTIVE]: state.dragonTriggerActive
  };
}
