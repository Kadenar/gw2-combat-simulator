/**
 * Owns Firebrand mantra preparation and charge-variant skill fragments.
 * Persistent mantra state and behavior remain in `mechanics/mantras.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const FIREBRAND_MANTRA_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PORTENT_OF_FREEDOM]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 25,
    ammo: 3,
    ammoRecharge: 25,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'stability', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 5, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_POTENCE]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.RESTORING_REPRIEVE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'protection', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 2, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_SOLACE]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 24,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.OVERWHELMING_CELERITY]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 8, duration: 10, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.ECHO_OF_TRUTH]: {
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.OPENING_PASSAGE]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.POTENT_HASTE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 2.5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 5, duration: 6, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_LIBERATION]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 40,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.MANTRA_OF_TRUTH]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.CLARIFIED_CONCLUSION]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.FLAME_RUSH]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-flame', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.MANTRA_OF_LORE]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.MANTRA_OF_FLAME]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.FLAME_SURGE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-flame', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 12
      }
    ]
  },
  [ID.REJUVENATING_RESPITE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'aegis', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'protection', duration: 3, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 3, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.UNHINDERED_DELIVERY]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'resolution', duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'stability', stacks: 5, duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'swiftness', duration: 5, audience: { recipients: 'party' as const } }
    ]
  }
});
