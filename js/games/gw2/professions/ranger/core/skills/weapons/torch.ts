/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_TORCH_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BONFIRE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: index * 1000,
          coefficient: 0.1
        }))
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
        ]
      }
    ]),

    cooldown: 25,
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 560,
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

    cooldown: 15,
    ammo: 2,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    castTimeMs: 440
  }
});
