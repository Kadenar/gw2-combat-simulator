import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  createThiefCoreState,
  THIEF_CORE_PUBLIC_STATE_PROJECTION,
  type ThiefCoreState
} from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';

export interface ThiefCoreReworkState extends ThiefCoreState {
  /** Refreshing mobility leaves one pending attack reward, never accumulated charges. */
  deftInitiationArmed: boolean;
}

/** The replacement module owns its extra state without extending the Live state contract. */
export function createThiefCoreReworkState(
  config: ThiefConfig,
  preparation: { balanceContext: ProfessionBalanceContext }
): ThiefCoreReworkState {
  return { ...createThiefCoreState(config, preparation), deftInitiationArmed: false };
}

/** Only replacement-module handlers call this accessor; a mismatched runtime is an assembly error. */
export function reworkCoreState(runtime: Pick<ThiefRuntime, 'profession'>): ThiefCoreReworkState {
  if (!('deftInitiationArmed' in runtime.profession.core)) throw new TypeError('Thief rework state is required.');

  return runtime.profession.core as ThiefCoreReworkState;
}

/** UI observations expose the pending reward; simulation prefixes are still rerun from their inputs. */
export const THIEF_CORE_REWORK_PUBLIC_STATE_PROJECTION = {
  ...THIEF_CORE_PUBLIC_STATE_PROJECTION,
  keys: [...THIEF_CORE_PUBLIC_STATE_PROJECTION.keys, 'deftInitiationArmed']
};
