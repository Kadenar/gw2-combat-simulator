import { BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/**
 * Owns Firebrand mantra preparation and charge-variant skill fragments.
 * Persistent mantra state and behavior remain in `mechanics/mantras.ts`.
 */

export const FIREBRAND_MANTRA_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PORTENT_OF_FREEDOM]: {
    cooldown: 25,
    ammo: 3,
    ammoRecharge: 25,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.STABILITY, duration: 5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 5, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  },
  [ID.MANTRA_OF_POTENCE]: {
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.RESTORING_REPRIEVE]: {
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.PROTECTION, duration: 2, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 2, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.MANTRA_OF_SOLACE]: {
    cooldown: 24,
    ammo: 0,
    ammoRecharge: 0,
    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.OVERWHELMING_CELERITY]: {
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.QUICKNESS, duration: 5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.MIGHT, stacks: 8, duration: 10, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.ECHO_OF_TRUTH]: {
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ],
    // Echo consumes the ordinary Truth follow-up on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.ECHO_OF_TRUTH } }]
  },
  [ID.POTENT_HASTE]: {
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.QUICKNESS, duration: 2.5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 6, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.MANTRA_OF_LIBERATION]: {
    cooldown: 40,
    ammo: 0,
    ammoRecharge: 0,
    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  },
  [ID.MANTRA_OF_TRUTH]: {
    castTimeMs: 200,
    effects: [],
    // Preserve its existing ordinary flip without adding it to the managed mantra charge families.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-follow-up' } }]
  },
  [ID.FLAME_RUSH]: {
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 12
      }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.MANTRA_OF_FLAME]: {
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.FLAME_SURGE]: {
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 12
      }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.REJUVENATING_RESPITE]: {
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.AEGIS, duration: 2, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.PROTECTION, duration: 3, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 3, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.UNHINDERED_DELIVERY]: {
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.RESOLUTION, duration: 8, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.STABILITY, stacks: 5, duration: 8, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.SWIFTNESS, duration: 5, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  }
});
