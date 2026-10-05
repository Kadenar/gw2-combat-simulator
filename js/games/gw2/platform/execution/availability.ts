import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
/** Cast availability distinguishes permanent denials from commands that can retry at a known time. */

export const CAST_READY: AvailabilityResult = Object.freeze({ ready: true });

/** Creates a command-scoped denial when time alone cannot make the attempted cast valid. */
export function denyCast(code: string, reason: string): AvailabilityResult {
  return { ready: false, retryAt: null, code, reason };
}

/** Creates a waitable denial with the exact simulation time at which every rule should be evaluated again. */
export function retryCast(retryAt: number, code: string, reason: string): AvailabilityResult {
  if (!Number.isFinite(retryAt)) {
    throw new TypeError('Cast availability retryAt must be finite.');
  }

  return { ready: false, retryAt, code, reason };
}

/**
 * Creates the common skill-scoped denial with a consistent warning. A null retry time rejects this rotation command;
 * a finite retry time asks the scheduler to try the same command later.
 */
export function denySkillCast(
  skill: Pick<Skill, 'name'>,
  code: string,
  cause: string,
  retryAt: number | null = null
): AvailabilityResult {
  const reason = `${skill.name} is unavailable — ${cause}`;
  return retryAt === null ? denyCast(code, reason) : retryCast(retryAt, code, reason);
}

/** Profession policies identify alternate slot faces without moving mechanic-specific availability gates. */
export interface SlotSelectionPolicy {
  readonly omittedLoadout?: 'allow' | 'deny';
  readonly identity?: (id: SkillId) => SkillId;
  readonly allowsFollowUp?: (skill: Skill, selected: ReadonlySet<SkillId>, catalog: CanonicalCatalog) => boolean;
}

/** Rejects unequipped slot skills at the caller's gate position; flips inherit their root's selection. */
export function selectedSlotSkillAvailability(
  context: { readonly config: Gw2Config; readonly catalog: CanonicalCatalog },
  skill: Skill,
  policy: SlotSelectionPolicy = {}
): AvailabilityResult | null {
  if (!['Heal', 'Utility', 'Elite'].includes(skill.type || '')) return null;
  // Ordinary sandbox casts allow omission; summon policies can require explicit equipment.
  const loadout = context.config.selectedSkillIds;
  if (loadout == null && policy.omittedLoadout !== 'deny') return null;
  const selected = selectedSkillIdSet(loadout);
  let root = skill;
  while (root.flipParentId != null) {
    const parent = context.catalog.skillsById.get(root.flipParentId);
    if (!parent) break;
    root = parent;
  }

  const identity = policy.identity;
  const equipped = identity ? [...selected].some((id) => identity(id) === identity(root.id)) : selected.has(root.id);
  return equipped || policy.allowsFollowUp?.(skill, selected, context.catalog)
    ? null
    : denySkillCast(skill, 'gw2.slot-not-equipped', 'the skill is not equipped.');
}
