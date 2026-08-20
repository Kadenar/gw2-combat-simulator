import { bladeswornState } from './state.js';
import type { WarriorCastContext } from '../../types.js';

/** Records multi-round ammo consumption for Bladesworn's ammo-reactive traits. */
export function recordBladeswornAmmoSpend(
  context: WarriorCastContext,
  roundsSpent: number,
  startedFull: boolean
): void {
  const state = bladeswornState.from(context);
  state.ammoRoundsSpentByActivation[context.reservationId] = roundsSpent;
  state.ammoStartedFullByActivation[context.reservationId] = startedFull;
}
