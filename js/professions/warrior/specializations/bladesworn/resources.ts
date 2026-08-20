import { bladeswornState } from './state.js';
import type { WarriorSchedulerContext } from '../../types.js';

/** Converts Warrior-family adrenaline gains into Bladesworn flow. */
export function gainBladeswornFlow(context: WarriorSchedulerContext, amount: number): void {
  const state = bladeswornState.from(context);
  state.flow = Math.min(state.maximumFlow, state.flow + Math.max(0, Number(amount || 0)));
}

/** Bladesworn replaces the normal strike-driven adrenaline loop with passive flow. */
export function bladeswornGainsAdrenalineOnHit(): boolean {
  return false;
}
