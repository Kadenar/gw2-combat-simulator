/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BLAZE_BREAKER]: {
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
    castTimeMs: 480,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.4
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ])
  },
  [ID.FLAMES_OF_WAR]: {
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    castTimeMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 5480, coefficient: 1 }]
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
        ]
      }
    ])
  }
});
