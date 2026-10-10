import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/**
 * Owns Firebrand mantra preparation and charge-variant skill fragments.
 * Persistent mantra state and behavior remain in `mechanics/mantras.ts`.
 */

export const FIREBRAND_MANTRA_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PORTENT_OF_FREEDOM]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_LIBERATION}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 25,
    ammo: 3,
    ammoRecharge: 25,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'stability', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 5, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_POTENCE]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_POTENCE}` } }],
    castTimeMs: 1520,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.RESTORING_REPRIEVE]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_SOLACE}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'protection', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 2, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_SOLACE]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_SOLACE}` } }],
    castTimeMs: 1520,
    canCastConcurrently: false,
    cooldown: 24,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.OVERWHELMING_CELERITY]: {
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_POTENCE}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 8, duration: 10, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.ECHO_OF_TRUTH]: {
    // Echo consumes the ordinary Truth follow-up on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.ECHO_OF_TRUTH } }],
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.POTENT_HASTE]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_POTENCE}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 2.5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 5, duration: 6, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_LIBERATION]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_LIBERATION}` } }],
    castTimeMs: 1520,
    canCastConcurrently: false,
    cooldown: 40,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.MANTRA_OF_TRUTH]: {
    // Preserve its existing ordinary flip without adding it to the managed mantra charge families.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-follow-up' } }],
    castTimeMs: 200,
    effects: []
  },
  [ID.FLAME_RUSH]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_FLAME}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
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
  [ID.MANTRA_OF_FLAME]: {
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_FLAME}` } }],
    castTimeMs: 1520,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.FLAME_SURGE]: {
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_FLAME}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
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
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_SOLACE}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'aegis', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'protection', duration: 3, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 3, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.UNHINDERED_DELIVERY]: {
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_LIBERATION}` } }],
    castTimeMs: 0,
    canCastConcurrently: true,
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'resolution', duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'stability', stacks: 5, duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'swiftness', duration: 5, audience: { recipients: 'party' as const } }
    ]
  }
});
