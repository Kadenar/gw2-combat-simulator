/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer rifle packet timing, projectile, movement, damage, and control behavior. */
export const ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RIFLE_BURST]: {
    implemented: true,
    // Rifle Burst is a channel: interruption retains landed packets and cancels only its future packet.
    quicknessCastTimeMs: 640,
    cooldown: 0,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        atMs: 320,
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
        metadata: {
          projectile: true
        }
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ]
  },
  [ID.NET_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 570,
    cooldown: 9,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Net Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 4,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.JUMP_SHOT]: {
    implemented: true,
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        atMs: 117,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Leap Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Landing Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 7,
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.BLUNDERBUSS]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        atMs: 368,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 9,
        atMs: 368,
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
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 14,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 451,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Overcharged Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 450
        }
      }
    ]
  },
  [ID.RIFLE_BURST_GRENADE]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ]
  }
});
