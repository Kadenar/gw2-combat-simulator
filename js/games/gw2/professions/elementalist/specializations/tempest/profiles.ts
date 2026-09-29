import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Stable patch targets for the overload mechanic and its Lightning Jolt skill variant. */
export const TEMPEST_BALANCE_PROFILE_IDS = Object.freeze({
  overloads: 'elementalist.tempest.overloads',
  lightningJolt: 'elementalist.tempest.lightning-jolt'
});

/**
 * Balance-authorable Tempest data: the overload singularity dwell timings, the Overload Air
 * follow-up strike. Trait profiles are authored beside their behavior in traits/.
 * Field names follow the generic profile schema, so several traits reuse `durationMultiplier` and
 * `maximumStacks` for values that are simply durations or caps in seconds.
 */
export const TEMPEST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.overloads,
    name: 'Tempest Overload Singularity',
    profileKind: 'mechanic',
    // Seconds an attunement must be held before its overload unlocks: `initialDelay` normally,
    // `durationMultiplier` once Transcendent Tempest shortens the wait.
    initialDelay: 6,
    durationMultiplier: 4,
    effects: []
  },
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.lightningJolt,
    parentId: ID.OVERLOAD_AIR,
    name: 'Overload Air - Lightning Jolt',
    profileKind: 'skill-variant',
    // Each affected ally receives one non-critical, unequipped-weapon strike for its next attack.
    effects: [{ name: 'Overload Air - Lightning Jolt', type: 'strike', coefficient: 1.32, hits: 1 }]
  }
]);
