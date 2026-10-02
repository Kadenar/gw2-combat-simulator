import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;
export const GUARDIAN_SPEAR_EXPIRY = 'guardian.spear-expiry';

/** Exclusive window expiry runs before same-time commands and cannot erase a refreshed occurrence. */
export function expireSpearIllumination(runtime: Runtime, data: unknown): void {
  const { symbol, expiresAt } = data as { symbol: boolean; expiresAt: number };
  const state = runtime.profession.core;
  if (symbol) {
    if (state.spearLuminanceUntil === expiresAt) state.spearLuminanceUntil = 0;
  } else if (state.spearIlluminatedUntil === expiresAt) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }
}
