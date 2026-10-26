import { ACTOR, COMBO_FINISHER, RECIPIENT, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines Engineer rifle packet timing, projectile, movement, damage, and control behavior. */
export const ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RIFLE_BURST]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    // Rifle Burst occupies an 840 ms channel; interruption retains landed packets and cancels future packets.
    castTimeMs: 840,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
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
        // Separate grenade damage in results while retaining the Rifle Burst cast as its owner.
        damageBreakdownName: 'Rifle Burst Grenade',
        sourceId: ID.RIFLE_BURST_GRENADE,
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ]
  },
  [ID.RIFLE_BURST_GRENADE]: {
    simulatorExcluded: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Rifle Burst Grenade',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ]
  },
  [ID.BLUNDERBUSS]: {
    cooldown: 6,
    castTimeMs: 400,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 9,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5
      }
    ])
  },
  [ID.NET_SHOT]: {
    cooldown: 9,
    castTimeMs: 600,
    // Commit Net Shot at 560 ms so later interruptions keep the activation.
    interruptCommitMs: 560,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Net Shot',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.OVERCHARGED_SHOT]: {
    cooldown: 14,
    castTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Overcharged Shot',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.LAUNCH
      }
    ]
  },
  [ID.JUMP_SHOT]: {
    cooldown: 18,
    castTimeMs: 1000,
    // Once the leap commits, retain its cast lockout and landing payload through interruption.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 120, coefficient: 0.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Leap Damage',
        actorType: ACTOR.PLAYER
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 2.4,
          hits: 1,
          name: 'Landing Damage',
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: COMBO_FINISHER.LEAP,
              fieldSelectionAnchor: 'castStart'
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 3,
          duration: 7,
          actorType: ACTOR.PLAYER
        }
      ])
    ]
  }
});
