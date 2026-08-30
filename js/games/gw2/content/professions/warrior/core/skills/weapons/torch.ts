/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BLAZE_BREAKER]: {
    implemented: true,
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    waves: 5,
    totalCoefficient: 2,
    maximumHitsPerTarget: 1,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FLAMES_OF_WAR]: {
    interruptCommitMs: 0,
    implemented: true,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 5480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 1480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5480,
            condition: 'Burning',
            stacks: 2,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  }
});
