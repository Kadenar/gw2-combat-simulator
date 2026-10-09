/** Core Warrior spear packets use nearest-40 ms offsets to remove false timing precision. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MAIMING_SPEAR]: {
    castTimeMs: 480,
    // Committed throws preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 440,
    interruptMode: 'commit',
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.1 }],
        name: 'Maiming Spear — Initial Strike Damage',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        // The single target receives the epicenter bonus on the aftershock only.
        modifiers: [
          {
            id: 'warrior.maiming-spear-epicenter',
            label: 'Maiming Spear - epicenter',
            target: 'strikeDamage',
            operation: 'multiply',
            factor: 1.5
          }
        ],
        ticks: [{ atMs: 1520, coefficient: 0.75 }],
        name: 'Maiming Spear — Aftershock Damage',
        // Only the delayed aftershock counts as an explosion for explosion-triggered effects.
        damageKind: 'explosion',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ])
  },
  [ID.MIGHTY_THROW]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    // Once the throw commits, its effects survive interruption.
    interruptCommitMs: 600,
    interruptMode: 'commit',
    // Both impact packets count as explosions; shards still require a secondary target.
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.2 }],
        name: 'Mighty Throw — Spear Damage',
        damageKind: 'explosion',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.9 }],
        name: 'Mighty Throw — Shard Damage',
        damageKind: 'explosion',
        // Single-target suppression follows this stable packet identity rather than the display label.
        metadata: { packetKind: 'warrior.mighty-throw-shard' },
        when: () => false, // Shards require a secondary target; this simulation has one target.
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ])
  },
  [ID.DISRUPTING_THROW]: {
    castTimeMs: 520,
    // Committed throws preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 400,
    interruptMode: 'commit',
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Projectile',
            chance: 1,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.SPEARMARSHALS_SUPPORT]: {
    castTimeMs: 520,
    // Once support commits, its delayed strikes survive interruption.
    interruptCommitMs: 480,
    interruptMode: 'commit',
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 960, coefficient: 0.5 },
          { atMs: 1160, coefficient: 0.5 },
          { atMs: 1360, coefficient: 0.5 },
          { atMs: 1560, coefficient: 0.5 },
          { atMs: 1760, coefficient: 0.5 },
          { atMs: 1960, coefficient: 0.5 },
          { atMs: 2160, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ])
  },
  [ID.SPEAR_SWIPE]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1240,
    effects: [
      {
        type: 'control',
        controlKind: 'launch'
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  }
});
