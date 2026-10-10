import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

/** Reads accumulated spending without consuming it; only an in-combat threshold check can request a pilfer. */
export function prodigiousPincherReady(runtime: ThiefRuntime): boolean {
  return (
    runtime.combatStartedAt() &&
    hasTrait(runtime, TRAIT.PRODIGIOUS_PINCHER) &&
    advanceCounter(
      antiquaryState.from(runtime).initiativeSpentSincePilfer,
      0,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PRODIGIOUS_PINCHER), 'threshold'),
      'retain'
    ).reached
  );
}

/** Only Swipe pilfers receive Prolific Plunderer's extra use. */
export function prolificPlundererUses(runtime: ThiefRuntime, source: string): number {
  return source === 'swipe' && hasTrait(runtime, TRAIT.PROLIFIC_PLUNDERER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PROLIFIC_PLUNDERER), 'resourceGain')
    : 0;
}
