import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

export interface ScourgeState {
  shadeGeneration: number;
  shades: number[];
  demonicLoreReadyAt: number;
  nourishingAshesReadyAt: number;
}

/** Declares Scourge's public compatibility field and inactive value. */
export const SCOURGE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  shades: []
} satisfies Partial<ScourgeState>);

/** Creates Scourge's timed shade and trait-cooldown runtime state. */
export function createScourgeState(): ScourgeState {
  const state: ScourgeState = {
    shadeGeneration: 0,
    // Each entry is an absolute expiry timestamp; the array length is the active shade count
    shades: [],
    demonicLoreReadyAt: 0,
    nourishingAshesReadyAt: 0
  };
  return state;
}

/** Removes expired shades at the Scourge module boundary. */
export function purgeScourgeTimedState(state: ScourgeState, at: number): void {
  state.shades = purgeExpiredStacks(state.shades, at);
}

// Shade lifetime and Sand Sage attributes read the same state.
export const scourgeState = defineProfessionSpecializationState('Scourge', createScourgeState);
