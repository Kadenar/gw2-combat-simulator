/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GRASPING_DEAD]: {
    castTimeMs: 880,
    // Committed casts retain the full lockout so cancelling cannot skip the aftercast.
    interruptCommitMs: 640,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 560, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10 }
      ]
    )
  },
  [ID.PUTRID_CURSE]: {
    castTimeMs: 600,
    interruptCommitMs: 520,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.5 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 },
        { type: 'condition', condition: 'Poisoned', stacks: 1, duration: 6 }
      ]
    )
  },
  [ID.BLOOD_CURSE]: {
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.35 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 }
    ])
  },
  [ID.RENDING_CURSE]: {
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.35 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 }
    ])
  },
  [ID.FEAST_OF_CORRUPTION]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4
      }
    ],
    lifeForceGain: 8,
    flipSkillId: null
  },
  [ID.DEVOURING_DARKNESS]: {
    castTimeMs: 600,
    effects: [],
    lifeForceGain: 8,
    // Custom: Scales Torment stacks from the target's active condition count; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.devouring-darkness',
    flipParentId: null
  }
});
