/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer rifle packet timing, projectile, movement, damage, and control behavior. */
export const ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RIFLE_BURST]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // Rifle Burst is a channel: interruption retains landed packets and cancels only its future packet.
    castTimeMs: 640,
    cooldown: 0,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            chance: 0.2,
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        projectile: true
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst Grenade',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      }
    ]
  },
  [ID.NET_SHOT]: {
    castTimeMs: 570,
    cooldown: 9,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Net Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ])
  },
  [ID.JUMP_SHOT]: {
    castTimeMs: 1000,

    cooldown: 18,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 120, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Leap Damage',
        actorType: 'player'
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 2.4,
          hits: 1,
          name: 'Landing Damage',
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: 'Leap',
              fieldSelectionAnchor: 'castStart',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 3,
          duration: 7,
          actorType: 'player'
        }
      ])
    ]
  },
  [ID.BLUNDERBUSS]: {
    castTimeMs: 400,
    cooldown: 6,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 9,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      }
    ])
  },
  [ID.OVERCHARGED_SHOT]: {
    castTimeMs: 400,
    cooldown: 14,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Overcharged Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch'
      }
    ]
  },
  [ID.RIFLE_BURST_GRENADE]: {
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Rifle Burst Grenade',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      }
    ]
  }
});
