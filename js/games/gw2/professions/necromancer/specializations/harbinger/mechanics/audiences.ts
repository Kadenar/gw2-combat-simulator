import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

export function party(runtime: NecromancerRuntime) {
  return {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}
