import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/core/profile-ids.js';
/**
 * Balance profiles for Core Elementalist: the authored, patch-tunable numbers
 * behind Core mechanics and weapon resources. Traits own their profiles in traits/.
 *
 * Shared mechanics keep their own ids; skill-owned payloads live on skills and
 * trait tuning lives beside its trait. Consumers read the selected catalog.
 */
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/**
 * Register only shared Core mechanic tuning with the module's catalog data.
 */
export const ELEMENTALIST_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Elementalist Attunements',
    profileKind: 'mechanic',
    recharge: 10,
    initialDelay: 1.5,
    effects: []
  },
  {
    id: ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.hammerOrbs,
    name: 'Elementalist Hammer Orbs',
    profileKind: 'mechanic',
    duration: 15,
    initialDelay: 0.48,
    effects: []
  }
]);
