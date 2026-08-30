/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DARK_PACT]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 10,
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Dark Pact grants 5% life force only after ripping a boon; its impact handler owns the self-bleed and immobilize.
    lifeForceGain: 5,
    handlerId: 'necromancer.dark-pact'
  },
  [ID.NECROTIC_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 2
      }
    ]
  },
  [ID.NECROTIC_STAB]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 4
  },
  [ID.NECROTIC_BITE]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'blind',
        metadata: {
          duration: 6
        }
      }
    ],
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.ENFEEBLING_BLOOD]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    // The ground packet launches by 638 ms and must survive a weapon-swap cancel until its delayed impact.
    interruptCommitMs: 638,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.LIFE_SIPHON]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 2.7,
        hits: 9,
        atMs: 480,
        intervalMs: 160,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ],
    handlerId: 'necromancer.life-siphon'
  }
});
