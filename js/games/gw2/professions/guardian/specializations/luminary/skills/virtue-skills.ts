/**
 * Owns Luminary Radiant Virtue skill fragments.
 * Persistent virtue state and behavior remain under Core and Luminary mechanics.
 */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const LUMINARY_VIRTUE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RADIANT_COURAGE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
        do: { type: 'rechargeReset', skillIds: [ID.GLEAMING_BLADE, ID.RADIANT_BULWARK] }
      }
    ],
    castTimeMs: 0,
    // Courage's activation grants these boons to the player and nearby allies.
    effects: [
      { type: 'boon', boon: 'aegis', duration: 20, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'resistance', duration: 4, audience: { recipients: 'party' } }
    ]
  },
  [ID.RADIANT_RESOLVE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
        do: { type: 'rechargeReset', skillIds: [ID.LUMINOUS_STAFF] }
      }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.RADIANT_JUSTICE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => hasTrait(runtime, TRAIT.MASTER_AT_ARMS),
        do: { type: 'rechargeReset', skillIds: [ID.DAZZLING_HAMMER] }
      }
    ],
    castTimeMs: 0,
    effects: []
  }
});
