import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Expiry tasks remove only windows whose current deadline has passed, preserving later refreshes. */
export function expireElementalistState(runtime: ElementalistRuntime): void {
  const state = runtime.profession.core;
  const at = runtime.time;
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  for (const [name, progress] of Object.entries(state.etchings))
    if (progress && progress.expiresAt <= at) state.etchings[name] = null;
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (state.hammerOrbs[element] != null && state.hammerOrbs[element]! <= at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }

  if (state.conjureEquipped && state.conjureExpiresAt <= at) {
    state.conjureEquipped = null;
    state.conjureExpiresAt = 0;
    resetAutoattackChains(runtime);
  }

  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups))
    if (expiresAt <= at) delete state.conjurePickups[weapon];
  if (state.dazingDischargeUntil <= at) state.dazingDischargeUntil = 0;
}
