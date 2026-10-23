import { canonicalTime } from '#kernel/core/clock.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

const SCEPTER_CHAIN_EXPIRY_TASK = 'mesmer.scepter-chain-expire';
// Manual test 20261023-163612 retains the chain 2.760s after completion and resets by 2.880s.
// Use 2.8s as the measured approximation; the log does not establish the exact in-animation timer anchor.
const SCEPTER_CHAIN_RETENTION_SECONDS = 2.8;

/** Replace the live deadline so stale tasks cannot reset a refreshed scepter chain. */
function setMesmerScepterChainExpiry(runtime: MesmerRuntime, expiresAt: number | null): void {
  const at = expiresAt == null ? null : canonicalTime(expiresAt);
  runtime.profession.core.scepterChainExpiresAt = at;

  if (at != null) runtime.schedule(SCEPTER_CHAIN_EXPIRY_TASK, at, { at }, undefined, -20);
}

/** Completed scepter autos refresh the window; intervening skills preserve it without extending its lifetime. */
export const mesmerScepterChainLifecycle = {
  onAutoattackChainTransition(runtime, cast, result) {
    const change = result.transitions.find((entry) => entry.chainRootId === ID.ETHER_BOLT);

    if (!change || change.decision === 'preserve') return;

    setMesmerScepterChainExpiry(
      runtime,
      change.decision === 'advance' ? cast.effectiveEnd + SCEPTER_CHAIN_RETENTION_SECONDS : null
    );
  },
  tasks: {
    [SCEPTER_CHAIN_EXPIRY_TASK](runtime, data) {
      if ((data as { at: number }).at !== runtime.profession.core.scepterChainExpiresAt) return;

      runtime.profession.core.scepterChainExpiresAt = null;
      resetAutoattackChains(runtime, [ID.ETHER_BOLT]);
    }
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
