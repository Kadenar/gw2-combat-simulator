/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BONFIRE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: index * 1000,
          coefficient: 0.1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Burning', stacks: 3, duration: 5 },
          ...Array.from({ length: 8 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          }))
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    recharge: 25,
    cooldown: 25,
    // Match the measured Quickness animation from the benchmark EVTC.
    quicknessCastTimeMs: 560,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Fire',
        duration: 8,
        startAnchor: 'castEnd'
      }
    ]
  },
  [ID.THROW_TORCH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.666,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10
      },
      {
        type: 'blind',
        duration: 3
      }
    ],
    recharge: 1,
    cooldown: 15,
    ammo: 2,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 440
  }
});
