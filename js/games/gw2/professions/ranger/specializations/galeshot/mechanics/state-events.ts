import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';

import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { boundedNumber } from '#kernel/core/numeric.js';

function handleGaleshotState(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = galeshotState.from(context);
  // Re-clamp on ingestion: the event value is already bounded, but resolver
  // state is reconstructed from log entries that may predate the cap.
  state.windForce = boundedNumber(
    event.windForce || 0,
    0,
    0,
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'minimumStacks')
  );
  state.galeForceUntil = Math.max(0, Number(event.galeForceUntil || 0));
  state.mistralUntil = Math.max(0, Number(event.mistralUntil || 0));
  state.wutheringWindReady = Boolean(event.wutheringWindReady);
  state.wutheringWindReadyAt = Math.max(0, Number(event.wutheringWindReadyAt || 0));
}

export const galeshotEventHandlers = Object.freeze({
  'ranger.galeshot-state': handleGaleshotState
});
