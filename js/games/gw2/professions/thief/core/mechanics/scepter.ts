import { canonicalTime } from '#kernel/core/clock.js';

import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import type { AutoattackChainTransitionResult } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const THIEF_SCEPTER_CHAIN_EXPIRY = 'thief.scepter-chain-expire';

/** Only a successful scepter chain step refreshes its three-second window from cast completion. */
export function transitionThiefScepterChain(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  result: AutoattackChainTransitionResult
): void {
  const change = result.transitions.find((entry) => entry.chainRootId === ID.SHADOW_BOLT);
  if (!result.committed || !change || change.decision === 'preserve') return;
  const core = runtime.profession.core;
  core.scepterChainExpiresAt = change.decision === 'advance' ? canonicalTime(cast.effectiveEnd + 3) : null;
  if (core.scepterChainExpiresAt != null)
    runtime.schedule(THIEF_SCEPTER_CHAIN_EXPIRY, core.scepterChainExpiresAt, { at: core.scepterChainExpiresAt });
}

/** Restores Shadow Bolt when the continuation window closes, including while other skills are casting. */
export function expireThiefScepterChain(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if ((data as { at: number }).at !== core.scepterChainExpiresAt) return;
  core.scepterChainExpiresAt = null;
  resetAutoattackChains(runtime, [ID.SHADOW_BOLT]);
}
