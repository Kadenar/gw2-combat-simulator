/**
 * Owns Soulbeast merged-pet skill fragments for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { COMBO_FIELD, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const SOULBEAST_PORCINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MAUL_ID_41406]: {
    castTimeMs: 560,
    interruptCommitMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [400, 440].map((atMs) => ({ atMs, coefficient: 1.1 }))
      },
      {
        type: 'condition',
        // Each impact applies one stack, keeping partial casts consistent with their landed hits.
        ticks: [400, 440].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }))
      }
    ])
  },
  [ID.UNDEAD_PLAGUE]: {
    castTimeMs: 680,
    interruptCommitMs: 680,
    comboFields: [
      { ownerId: 'ranger', fieldType: COMBO_FIELD.POISON, duration: 5, startMs: 680, startAnchor: 'castStart' }
    ],
    // The cast launches a five-pulse poison field; later pulses survive the next player action.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      { type: 'strike', ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({ atMs, coefficient: 0.2 })) },
      {
        type: 'condition',
        ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 4
        }))
      }
    ])
  },
  [ID.BRUTAL_CHARGE_ID_46432]: {
    castTimeMs: 0,
    // The queued charge contacts after travel; damage and knockdown must refresh Claw at impact, not activation.
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.67,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  }
});
