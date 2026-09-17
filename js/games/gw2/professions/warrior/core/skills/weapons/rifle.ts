/** Rifle packets use close-range cast-start offsets so projectile travel does not inflate their timing. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RIFLE_BUTT]: {
    // Rifle Butt uses its successful-hit recharge and reloads the rest of the rifle kit on completion.
    cooldown: 12,
    mechanicTriggers: [
      {
        type: 'warrior.core.reload-rifle',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'knockback',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.VOLLEY]: {
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    interruptMode: 'per-packet',
    castTimeMs: 1760,
    effects: [
      {
        type: 'strike',
        // The fifth close-range packet is inferred from the complete, more distant cast.
        ticks: [
          { atMs: 440, coefficient: 0.8 },
          { atMs: 720, coefficient: 0.8 },
          { atMs: 1000, coefficient: 0.8 },
          { atMs: 1320, coefficient: 0.8 },
          { atMs: 1600, coefficient: 0.8 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIERCE_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // Rifle projectile finishers stay declarative so each emitted shot uses the shared combo scheduler.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.EXPLOSIVE_SHELL]: {
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        damageKind: 'explosion',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BRUTAL_SHOT]: {
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 12
      }
    ]
  }
});
