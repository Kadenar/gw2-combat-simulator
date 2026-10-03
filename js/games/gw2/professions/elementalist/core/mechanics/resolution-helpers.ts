/** Shared resolver-side state, attribution, boon, and condition helpers for Elementalist behavior. */
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { isTimeInWindow } from '#kernel/core/clock.js';

/** Returns active resolver-side applications of one boon kind at a timestamp. */
export function activeElementalistBuffs(context: Gw2ResolverRuntime, kind: string, at: number) {
  return (context.boons.get(kind.toLowerCase()) || []).filter((application) =>
    isTimeInWindow(at, application.at, application.expiresAt)
  );
}

/** Rewrites active applications of a boon kind while preserving inactive applications. */
export function refreshElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number
): void {
  const normalized = kind.toLowerCase();
  const applications = context.boons.get(normalized) || [];
  const active = new Set(activeElementalistBuffs(context, normalized, at));
  context.boons.set(
    normalized,
    applications.map((application) =>
      active.has(application)
        ? {
            ...application,
            expiresAt: expiresAt(application.expiresAt)
          }
        : application
    )
  );
}
