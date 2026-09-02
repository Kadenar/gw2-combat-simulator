/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DARK_PACT]: {
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 2.4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 2, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Dark Pact grants 5% life force only after ripping a boon; its impact handler owns the self-bleed and immobilize.
    lifeForceGain: 5,
    // Custom: Applies self-bleeding and target immobilize only after the first hit; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.dark-pact'
  },
  [ID.NECROTIC_SLASH]: {
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 2,
        atMs: 0
      }
    ]
  },
  [ID.NECROTIC_STAB]: {
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 4
  },
  [ID.NECROTIC_BITE]: {
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      }
    ],
    lifeForceGain: 8
  },
  [ID.DEATHLY_SWARM]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'blind',
        duration: 6
      }
    ],
    // Custom: Moves a skill-specific number of active self-conditions to the target; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.ENFEEBLING_BLOOD]: {
    quicknessCastTimeMs: 840,
    // The ground packet launches by 638 ms and must survive a weapon-swap cancel until its delayed impact.
    interruptCommitMs: 638,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1200, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1200, condition: 'Bleeding', stacks: 3, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1200, condition: 'Weakness', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.LIFE_SIPHON]: {
    interruptCommitMs: 0,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: 480 + index * 160, coefficient: 2.7 / 9 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    // Custom: Applies Life Siphon's self-bleeding on its first resolved hit; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.life-siphon'
  }
});
