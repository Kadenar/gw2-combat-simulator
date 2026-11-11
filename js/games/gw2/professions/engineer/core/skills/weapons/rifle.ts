/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines Engineer rifle packet timing, projectile, movement, damage, and control behavior. */
export const ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<EngineerSkill>>> = {
  [ID.RIFLE_BURST]: {
    name: 'Rifle Burst',
    icon: 'https://render.guildwars2.com/file/30F4477E57FFF65C3302F5380D5FCB654CA2E95F/102815.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
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
    name: 'Rifle Burst Grenade',
    icon: 'https://render.guildwars2.com/file/5B2AB667667749BC1BC7AEFD27362E3E0E0F2FE6/103294.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    rotationInputExcluded: true,
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
  [ID.ROCKET_BURST]: {
    name: 'Rocket Burst',
    icon: 'https://render.guildwars2.com/file/C7595DEF03CB2EFEFB5FD1DE9599166524725E4E/103938.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 840,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.65 },
          { atMs: 520, coefficient: 0.65 },
          { atMs: 680, coefficient: 0.65 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rocket Burst',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ],
    // Starting the volley spends the single use even if the player interrupts it.
    sideEffects: [{ on: 'castStart', do: { type: 'flipConsume', skillId: ID.ROCKET_BURST } }]
  },
  [ID.BLUNDERBUSS]: {
    name: 'Blunderbuss',
    icon: 'https://render.guildwars2.com/file/FC0C5A43332CBCEEFB32EF5331F89650FC0AF310/103111.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
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
    name: 'Net Shot',
    icon: 'https://render.guildwars2.com/file/A47830A4152F5F5DEC5D22975DE0449A57F2D570/102982.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    cooldown: 9,
    castTimeMs: 600,
    // Commit Net Shot at 560 ms so later interruptions keep the activation.
    interruptCommitMs: 560,
    // Either rifle trigger refreshes one five-second Rocket Burst opportunity.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.ROCKET_BURST, durationSec: 5 } }],
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
    name: 'Overcharged Shot',
    icon: 'https://render.guildwars2.com/file/5B1B070F59C3FDB22794910FBD1C4C7DBF3BD47E/102790.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    cooldown: 14,
    castTimeMs: 400,
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.ROCKET_BURST, durationSec: 5 } }],
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
    name: 'Jump Shot',
    icon: 'https://render.guildwars2.com/file/6B29C1E841653F64FCB769236177CFC836C8B933/102798.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
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
};
