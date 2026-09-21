/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_VENGEANCE]: {
    castTimeMs: 800,
    interruptCommitMs: 760,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 680, startAnchor: 'castStart' }],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({
            atMs,
            coefficient: 0.6
          }))
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: 680 + index * 1000,
            condition: 'Bleeding',
            stacks: 1,
            duration: 3
          }))
        }
      ]),
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5
      },
      // Later symbol pulses repeat Fury at their fixed offsets after the initial application.
      ...[1680, 2680, 3680, 4680].map((atMs) => ({
        type: 'boon' as const,
        boon: 'fury',
        duration: 1.5,
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        persistsAfterInterrupt: true
      })),
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  [ID.SEARING_SLASH]: {
    castTimeMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [480, 640].map((atMs) => ({ atMs, coefficient: 1.2 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Burning', stacks: 2, duration: 2 }]
      }
    ])
  },
  [ID.BLEEDING_EDGE]: {
    castTimeMs: 680,
    interruptCommitMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [480, 640].map((atMs) => ({ atMs, coefficient: 0.36 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 2, duration: 1 }]
      }
    ])
  },
  [ID.CORE_CLEAVE]: {
    castTimeMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 600].map((atMs) => ({ atMs, coefficient: 0.36 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 600, condition: 'Bleeding', stacks: 2, duration: 1 }]
      }
    ])
  },
  [ID.BLAZING_EDGE]: {
    castTimeMs: 520,
    // Share the strike and Burning impact while the pull retains cast-completion timing.
    effects: [
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.8
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 1,
          duration: 3
        }
      ]),
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  }
});
