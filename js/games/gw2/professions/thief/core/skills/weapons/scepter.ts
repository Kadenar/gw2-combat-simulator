// Name packets independently for patch deletion while preserving their shared attribution.
/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SHADOW_BOLT]: {
    name: 'Shadow Bolt',
    description: 'Fire a projectile that hinders foes and helps allies.',
    icon: 'https://render.guildwars2.com/file/D6D1A6997E0E07ECC3A2CF61C0AC054B2102A369/2503744.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 520,
    // The bolt commits before the aftercast ends; EVTC keeps raw sub-480 ms attempts below this grid boundary.
    interruptCommitMs: 480,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Shadow Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DOUBLE_BOLT]: {
    name: 'Double Bolt',
    description: 'Fire two projectiles that hinder foes and help allies.',
    icon: 'https://render.guildwars2.com/file/C7D7DF4CB2E9D52E4EDF735627063F0C41A878AC/2503735.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 640,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.375 }],
        name: 'Double Bolt - First Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 0.375 }],
        name: 'Double Bolt - Second Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [320, 600].map((atMs) => ({ atMs, condition: CONDITION.TORMENT, stacks: 1, duration: 4 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.TRIPLE_BOLT]: {
    name: 'Triple Bolt',
    description: 'Fire three missiles that hinder foes and help allies.',
    icon: 'https://render.guildwars2.com/file/C505F1FEF4DAFA05126CF14D1B0CDC2511F8CEEB/2503749.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 1080,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.45 }],
        name: 'Triple Bolt - First Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 0.45 }],
        name: 'Triple Bolt - Second Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1040, coefficient: 0.45 }],
        name: 'Triple Bolt - Third Bolt',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [320, 640, 1040].map((atMs) => ({ atMs, condition: CONDITION.TORMENT, stacks: 1, duration: 5 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOWSQUALL]: {
    name: 'Shadowsquall',
    description: 'Stealth Attack. Unleash a barrage from the shadows toward your target.',
    icon: 'https://render.guildwars2.com/file/02C8462294CFA9AFAB36A5364CA2C0E0AE13129F/2503747.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',

    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    cooldown: 0,
    initiativeCost: 0,
    requiredMainHand: WEAPON.SCEPTER,
    stealthAttack: true,
    castTimeMs: 1960,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [240, 480, 720, 1000, 1240, 1480, 1720, 1960].map((atMs) => ({ atMs, coefficient: 1.6 / 8 })),
        name: 'Shadowsquall',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [240, 480, 720, 1000, 1240, 1480, 1720, 1960].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 3
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOW_SAP]: {
    name: 'Shadow Sap',
    description: 'Hurl a bolt of unfurling shadows to bolster allies.',
    icon: 'https://render.guildwars2.com/file/C7F90ED7C6D2944A3258CFF1B75CC2D4EE36384A/2503746.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 600,
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.77 }],
        name: 'Shadow Sap',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.TRIPLE_THREAT]: {
    name: 'Triple Threat',
    description: 'Fire three missiles that hinder foes and help allies.',
    icon: 'https://render.guildwars2.com/file/A9905B250CDB0820D4A51C623A6ED6024B33D897/2503750.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.SCEPTER,
    requiredOffHand: false,
    castTimeMs: 1000,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [320, 680, 1000].map((atMs) => ({
          atMs,
          coefficient: 1.35 / 3
        })),
        name: 'Triple Threat',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [320, 680, 1000].map((atMs) => ({ atMs, condition: CONDITION.TORMENT, stacks: 1, duration: 4 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.TWILIGHT_COMBO]: {
    name: 'Twilight Combo',
    description: 'Dual Wield. Fire a slow-moving projectile, then fire a quick shot that accelerates the first.',
    icon: 'https://render.guildwars2.com/file/FB0F9FF5A67F57F8E8B0D8B20F0F53D0CEBDF317/2503751.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.SCEPTER,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 760,
    // The paired projectiles are committed before the remaining aftercast; the log permits the next input immediately.
    interruptCommitMs: 720,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1 }],
        name: 'Initial Attack',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 0.5 }],
        name: 'Secondary Attack',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'condition',
          condition: CONDITION.CHILLED,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: CONDITION.TORMENT, stacks: 3, duration: 5 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ])
  },
  [ID.MEASURED_SHOT]: {
    name: 'Measured Shot',
    description: 'Dual Wield. Shadowstep and fire a shot that hinders foes and helps allies.',
    icon: 'https://render.guildwars2.com/file/F70A335A50480D68FCCDCE447EED16A25C3CAD01/2503742.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    // This opener arms its declared dual-wield follow-up.
    dualWieldOpener: true,
    // Endless Night replaces Measured Shot for five seconds after the shot commits.
    flipDuration: 5,
    cooldown: 0,
    initiativeCost: 4,
    movementSkill: true,
    shadowstepSkill: true,
    requiredMainHand: WEAPON.SCEPTER,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 560,
    // Commit the shot at 320 ms, preserving its impact and remaining cast lockout after interruption.
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects(
      {
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      [
        {
          type: 'strike',
          coefficient: 0.33,
          hits: 1,
          name: 'Measured Shot',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 1,
          actorType: ACTOR.PLAYER
        }
      ]
    ),
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.ENDLESS_NIGHT } }]
  },
  [ID.ENDLESS_NIGHT]: {
    name: 'Endless Night',
    description: 'Dual Wield. Fire a beam that hinders foes and helps allies.',
    icon: 'https://render.guildwars2.com/file/15BE9504ACEED3C462F7173D63E44836BFA2F934/2503736.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_3',
    dualWieldAttack: true,
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 3,
    requiredMainHand: WEAPON.SCEPTER,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 1920,
    // Retain each beam packet already emitted when the channel is interrupted.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          coefficient: 2.31 / 7
        })),
        name: 'Endless Night',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        // Every beam pulse applies Slow alongside its Torment packet.
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          condition: CONDITION.SLOW,
          stacks: 1,
          duration: 1.5
        })),
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 6
        })),
        actorType: ACTOR.PLAYER
      }
    ]),
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.ENDLESS_NIGHT } }]
  }
});
