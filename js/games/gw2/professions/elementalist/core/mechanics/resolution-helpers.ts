import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
/** Shared resolver-side state, attribution, boon, and condition helpers for Elementalist behavior. */

import { isTimeInWindow } from '#kernel/core/clock.js';

/** Returns active resolver-side applications of one buff kind at a timestamp. */
export function activeElementalistBuffs(context: MechanicCombatContext, kind: string, at: number) {
  return context.combat
    .buffApplications(kind.toLowerCase())
    .filter((application) => isTimeInWindow(at, application.at, application.expiresAt));
}

/** Rewrites active applications of a buff kind while preserving inactive applications. */
export function refreshElementalistBuffs(
  context: MechanicCombatContext,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number
): void {
  const normalized = kind.toLowerCase();
  context.combat.reviseBuffExpiry(
    normalized,
    (application) => isTimeInWindow(at, application.at, application.expiresAt),
    expiresAt
  );
}
