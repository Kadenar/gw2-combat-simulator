import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { grantExpandedConsciousness } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';

/** Affinity is combat-only and capped; reaching the cap grants Expanded Consciousness Energy. */
export function gainAffinity(runtime: RevenantRuntime, amount: number): void {
  if (runtime.config.specialization !== 'Conduit' || !runtime.combatStartedAt()) return;
  const state = conduitState.from(runtime);
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  state.affinityMaximum = maximum;
  const previous = state.affinity || 0;
  state.affinity = grantCapped(previous, amount, maximum);
  grantExpandedConsciousness(runtime, previous, maximum);
}
