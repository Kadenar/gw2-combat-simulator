import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type WarriorRuntime = Gw2Runtime<WarriorRuntimeState>;

/** Accepted gains mutate the current pool immediately, capped by its owning specialization. */
export function grantWarriorAdrenaline(runtime: WarriorRuntime, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0)
    throw new RangeError('Adrenaline grants must be finite and non-negative.');
  // Bladesworn converts authored and trait grants into its single Flow pool.
  const specialization = runtime.profession.specialization;
  if (specialization.kind === 'Bladesworn') {
    const state = specialization.state;
    state.flow = Math.min(state.maximumFlow, state.flow + amount);
    return;
  }

  const state = runtime.profession.core;
  state.adrenaline = Math.min(state.maximumAdrenaline, state.adrenaline + amount);
}
