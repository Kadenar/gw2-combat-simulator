/**
 * Owns shared Weaver hand availability and hammer orb restrictions.
 * The cataloged weapon fragments live in
 * `skills/weapons/hammer.ts`.
 */
import { WEAPON } from '#gw2/platform/constants.js';
import { denyCast, retryCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { HAMMER_ORB_REUSE_DELAY } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { isElementalistAttunement, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Parses canonical skill metadata for a valid pair of distinct Weaver attunements. */
export function weaverDualAttunements(skill: Skill): readonly [ElementalistAttunement, ElementalistAttunement] | null {
  const parts = String(skill.attunement || '').split('+');

  if (parts.length !== 2) return null;

  const [first, second] = parts;

  if (!isElementalistAttunement(first) || !isElementalistAttunement(second) || first === second) return null;

  return [first, second];
}

/** Slots 1–2 use the primary hand, 3 requires both elements, and 4–5 use the secondary; Unravel uses only primary. */
export function weaverWeaponAttunementAvailable(
  skill: Skill,
  primary: string,
  secondary: string,
  unravelActive: boolean
): boolean {
  const dual = weaverDualAttunements(skill);
  const required = dual || [String(skill.attunement)];
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  return unravelActive
    ? required.length === 1 && required[0] === primary
    : dual
      ? slot === 3 && required.every((element) => [primary, secondary].includes(element))
      : slot <= 2
        ? required[0] === primary
        : slot >= 4
          ? required[0] === secondary
          : primary === secondary && required[0] === primary;
}

/** Checks the shared orb lockout and duplicate-orb restriction for Weaver dual skills. */
export function weaverHammerAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  if (skillWeapon(skill) !== WEAPON.HAMMER) return null;

  const elements = weaverDualAttunements(skill);

  if (!elements) return null;

  const state = professionCoreState(context);
  // Every dual hammer skill shares one short lockout after the last orb cast.
  // The unarmed negative-infinity sentinel stays ready; armed deadlines use the canonical clock.
  const retryAt = Number.isFinite(state.hammerOrbLastCastAt)
    ? canonicalTime(state.hammerOrbLastCastAt + HAMMER_ORB_REUSE_DELAY)
    : state.hammerOrbLastCastAt;

  if (retryAt > context.time) {
    return retryCast(
      retryAt,
      'elementalist.hammer-orb-lockout',
      `${skill.name} is unavailable - the shared orb lockout ends at ${retryAt.toFixed(3)}.`
    );
  }

  if (elements.some((element) => state.hammerOrbs[element] != null && state.hammerOrbs[element] >= context.time)) {
    return denyCast(
      'elementalist.hammer-orb-active',
      `${skill.name} is unavailable - Grand Finale must consume the active orb first.`
    );
  }

  // The shared Weaver availability ladder validates the hands and Unravel after these resource checks.
  return { ready: true };
}
