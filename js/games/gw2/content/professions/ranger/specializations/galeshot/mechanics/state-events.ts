import type { RangerResolverContext, RangerResolverEvent } from '#gw2/content/professions/ranger/types.js';
import { galeshotState } from '#gw2/content/professions/ranger/specializations/galeshot/state.js';
import { rangerBalanceValue } from '#gw2/content/professions/ranger/core/profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/galeshot/profiles.js';

export function handleGaleshotState(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = galeshotState.from(context);
  // Re-clamp on ingestion: the event value is already bounded, but resolver
  // state is reconstructed from log entries that may predate the cap.
  state.windForce = Math.max(
    0,
    Math.min(rangerBalanceValue(context, PROFILE.resources, 'minimumStacks', 5), Number(event.windForce || 0))
  );
  state.galeForceUntil = Math.max(0, Number(event.galeForceUntil || 0));
  state.mistralUntil = Math.max(0, Number(event.mistralUntil || 0));
  state.wutheringWindReady = Boolean(event.wutheringWindReady);
  state.wutheringWindReadyAt = Math.max(0, Number(event.wutheringWindReadyAt || 0));
}

export const galeshotEventHandlers = Object.freeze({
  'ranger.galeshot-state': handleGaleshotState
});
