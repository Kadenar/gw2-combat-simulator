import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';

/** One exact window drives casting and presentation; identity survives detached scheduler payloads. */
export interface SkillFlipWindow {
  readonly identity: number | string;
  readonly visibleAt: number;
  readonly availableAt: number;
  readonly expiresAt: number | null;
}

export type SkillFlipWindows = Record<string, SkillFlipWindow>;

// Per-registry sequences keep repeated simulations deterministic and do not reuse consumed occurrences.
const sequences = new WeakMap<SkillFlipWindows, number>();

/** Opens an authored follow-up without imposing parent, recharge, ammo, or cast-phase policy. */
export function armSkillFlip(
  flips: SkillFlipWindows,
  skillId: string | number,
  availableAt: number,
  expiresAt = Infinity,
  visibleAt = availableAt,
  identity?: number | string
): SkillFlipWindow {
  const sequence =
    Math.max(
      sequences.get(flips) ?? 0,
      ...Object.values(flips).map((window) => (typeof window.identity === 'number' ? window.identity : 0))
    ) + 1;
  sequences.set(flips, sequence);
  const window = {
    identity: identity ?? sequence,
    visibleAt: canonicalTime(visibleAt),
    availableAt: canonicalTime(availableAt),
    expiresAt: expiresAt === Infinity ? null : canonicalTime(expiresAt)
  };
  if (window.visibleAt > window.availableAt || window.availableAt > (window.expiresAt ?? Infinity)) {
    throw new RangeError('Flip visibility, availability, and expiry must be ordered.');
  }

  flips[skillId] = window;
  return window;
}

/** Removes one choice and returns its captured window for profession-owned transition effects. */
export function consumeSkillFlip(flips: SkillFlipWindows, skillId: string | number): SkillFlipWindow | undefined {
  const window = flips[skillId];
  delete flips[skillId];
  return window;
}

/** Visibility may precede readiness, but both close at the exact exclusive expiry. */
export function skillFlipVisible(window: SkillFlipWindow | undefined, at: number): boolean {
  return !!window && isTimeInWindow(at, window.visibleAt, window.expiresAt ?? Infinity);
}

export function skillFlipReady(window: SkillFlipWindow | undefined, at: number): boolean {
  return !!window && isTimeInWindow(at, window.availableAt, window.expiresAt ?? Infinity);
}

/** A queued expiry may clear only the occurrence it captured, even when a replacement has the same deadline. */
export function expireSkillFlip(
  flips: SkillFlipWindows,
  skillId: string | number,
  at: number,
  identity = flips[skillId]?.identity
): (SkillFlipWindow & { readonly expiresAt: number }) | undefined {
  const window = flips[skillId];
  if (!window || window.identity !== identity || window.expiresAt === null || window.expiresAt > canonicalTime(at))
    return undefined;
  consumeSkillFlip(flips, skillId);
  return window as SkillFlipWindow & { readonly expiresAt: number };
}

/** Prunes ordinary windows; callers retain payload-bearing expiries until their effect handler runs. */
export function pruneSkillFlips(flips: SkillFlipWindows, at: number): void {
  for (const id of Object.keys(flips)) expireSkillFlip(flips, id, at);
}
