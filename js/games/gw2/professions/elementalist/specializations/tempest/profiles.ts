import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Stable patch targets for the overload mechanic and its Lightning Jolt skill variant. */
export const TEMPEST_BALANCE_PROFILE_IDS = Object.freeze({
  overloads: 'elementalist.tempest.overloads',
  lightningJolt: 'elementalist.tempest.lightning-jolt'
});

/**
 * Balance-authorable Tempest data: the overload singularity dwell timings, the Overload Air
 * follow-up strike. Trait profiles are authored beside their behavior in traits/.
 * The selected dwell duration is expressed in seconds before recharge-rate scaling.
 */
export const TEMPEST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: TEMPEST_BALANCE_PROFILE_IDS.overloads,
    name: 'Tempest Overload Singularity',
    profileKind: 'mechanic',
    // Seconds an attunement must be held before its overload unlocks: `initialDelay` normally,
    // `duration` once Transcendent Tempest shortens the wait.
    initialDelay: 6,
    duration: 4,
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
