import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';

/** Converts Warrior-family adrenaline gains into Bladesworn flow. */
export function gainBladeswornFlow(context: WarriorSchedulerContext, amount: number): void {
  const state = bladeswornState.from(context);
  state.flow = grantCapped(state.flow, amount, state.maximumFlow);
}
