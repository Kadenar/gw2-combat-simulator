/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer rifle packet timing, projectile, movement, damage, and control behavior. */
export const ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RIFLE_BURST]: {
    // Rifle Burst is a channel: interruption retains landed packets and cancels only its future packet.
    quicknessCastTimeMs: 640,
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
    quicknessCastTimeMs: 570,
    cooldown: 9,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 518, coefficient: 1.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Net Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 518, condition: 'Vulnerability', stacks: 8, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 518, condition: 'Immobilized', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.JUMP_SHOT]: {
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 117, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Leap Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 2.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Landing Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1000, condition: 'Vulnerability', stacks: 3, duration: 7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.BLUNDERBUSS]: {
    quicknessCastTimeMs: 400,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 368, coefficient: 2.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 368, condition: 'Bleeding', stacks: 3, duration: 9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5,
        atMs: 368,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.OVERCHARGED_SHOT]: {
    quicknessCastTimeMs: 400,
    cooldown: 14,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 451, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Overcharged Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch',
        duration: 450
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
