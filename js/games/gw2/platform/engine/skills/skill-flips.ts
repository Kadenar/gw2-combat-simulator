import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

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

/**
 * The follow-up a completed parent opens: its flip skill, unless that is merely the next autoattack chain step or a
 * skill that names another parent.
 */
export function followUpOf(skillsById: ReadonlyMap<SkillId, Skill>, skill: Skill): Skill | undefined {
  if (skill.flipSkillId == null || skill.flipSkillId === skill.nextChainId) return undefined;
  const followUp = skillsById.get(Number(skill.flipSkillId)) ?? skillsById.get(skill.flipSkillId);
  return followUp?.flipParentId === skill.id ? followUp : undefined;
}

/** Why the weapon follow-up rule blocks a skill: its window is closed, or its follow-up's window has replaced it. */
export type WeaponFlipBlock = { readonly kind: 'closed'; readonly parent: Skill } | { readonly kind: 'open' };

/**
 * The one bar-slot rule for weapon follow-ups: a follow-up that replaces its parent is castable only while its window
 * is ready, and while that window is ready the parent stays hidden behind it. A chained autoattack step shares its slot
 * without a window, so it never hides its parent. Runtime availability and the palette both read this rule.
 */
export function weaponFlipBlock(
  flips: SkillFlipWindows | undefined,
  skillsById: ReadonlyMap<SkillId, Skill>,
  skill: Skill,
  at: number
): WeaponFlipBlock | null {
  if (skill.type !== 'Weapon') return null;
  const parent = skill.flipParentId == null ? undefined : skillsById.get(Number(skill.flipParentId));
  if (parent?.flipSkillId === skill.id && !skillFlipReady(flips?.[skill.id], at)) return { kind: 'closed', parent };
  return weaponFollowUpOpen(flips, skill, at) ? { kind: 'open' } : null;
}

/** The parent half of the rule: a weapon skill is hidden while its own follow-up's window is ready. */
export function weaponFollowUpOpen(
  flips: SkillFlipWindows | undefined,
  skill: Pick<Skill, 'type' | 'flipSkillId' | 'nextChainId'>,
  at: number
): boolean {
  return (
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skillFlipReady(flips?.[skill.flipSkillId], at)
  );
}
