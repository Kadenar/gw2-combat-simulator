import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';

export const FORM_EXPIRY = 'revenant.conduit-form-expiry';

export function scheduleFormExpiry(runtime: RevenantRuntime): void {
  const until = conduitState.from(runtime).cosmicWisdomUntil;

  if (until > runtime.time) runtime.schedule(FORM_EXPIRY, until, { until }, undefined, -200);
}
