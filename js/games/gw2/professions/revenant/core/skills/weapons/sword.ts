/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Snap each intended packet independently so rounding a repeated interval cannot accumulate drift.
export const REVENANT_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.PREPARATION_THRUST]: {
    name: 'Preparation Thrust',
    icon: 'https://render.guildwars2.com/file/09B709249BD429435E53DEA0E2E701560F68DD1B/1013000.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 360,
    // A shortened opening thrust can land and advance the chain before its full animation ends.
    interruptCommitMs: 320,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Preparation Thrust',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.BRUTAL_BLADE]: {
    name: 'Brutal Blade',
    icon: 'https://render.guildwars2.com/file/A3E65AA00621DE0915C6607BB6E9084D0B480CCC/1013001.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 560,
    interruptCommitMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Brutal Blade',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.RIFT_SLASH]: {
    name: 'Rift Slash',
    icon: 'https://render.guildwars2.com/file/91913B6196F06B95EBC71FC3EE9B41004B1EDF09/1013002.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 480,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.9 }],
        name: 'Rift Slash',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1400, coefficient: 0.2175 }],
        name: 'Rift Slash - Rift',
        // The delayed rift has its own logged damage identity, separate from the sword attack.
        damageBreakdownName: 'Rift Slash - Rift',
        sourceId: 29073,
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.CHILLING_ISOLATION]: {
    name: 'Chilling Isolation',
    icon: 'https://render.guildwars2.com/file/5201D39E6CC216A5A64E17F6E6ECB15708F103EE/1013003.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 5,
    energyCost: 5,
    castTimeMs: 680,
    interruptCommitMs: 320,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        name: 'Chilling Isolation - Packet 1',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.6 }],
        name: 'Isolated Damage',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: CONDITION.CHILLED, stacks: 1, duration: 2 }],
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.UNRELENTING_ASSAULT]: {
    name: 'Unrelenting Assault',
    icon: 'https://render.guildwars2.com/file/A1E252A0C9F506B73465E09919D119D706702DD8/1013004.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    // The opening shadowstep triggers one relic attack.
    shadowstepSkill: true,
    peithaImpactDelayMs: 940,
    cooldown: 12,
    energyCost: 15,
    castTimeMs: 2000,
    effects: [
      {
        type: 'strike',
        ticks: [760, 1040, 1320, 1600, 1880].map((atMs) => ({
          atMs,
          coefficient: 3.9325 / 5
        })),
        name: 'Unrelenting Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.SHACKLING_WAVE]: {
    name: 'Shackling Wave',
    icon: 'https://render.guildwars2.com/file/C9AA7D9B9BDE6652194A5963F5C2694C3AE0CEF6/1030006.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 15,
    energyCost: 10,
    castTimeMs: 800,
    // The follow-up wave keeps landing after a 720 ms aftercast cancellation.
    interruptCommitMs: 720,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1.2 }],
        name: 'Initial Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        name: 'Additional Strikes',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 720, coefficient: 0.4 },
          { atMs: 800, coefficient: 0.4 },
          { atMs: 880, coefficient: 0.4 },
          { atMs: 960, coefficient: 0.4 },
          { atMs: 1040, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 1,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 8,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ])
    ]
  },
  [ID.DEATHSTRIKE]: {
    name: 'Deathstrike',
    icon: 'https://render.guildwars2.com/file/030BA607CA9D6A0D0E29F53C201421019263F353/1876877.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    // Relic of Peitha impacts 240 ms after the initial strike (320 ms).
    shadowstepSkill: true,
    peithaImpactDelayMs: 560,
    cooldown: 15,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: 420,
    energyCost: 10,
    castTimeMs: 720,
    interruptCommitMs: 680,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.45 }],
        name: 'Deathstrike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.67 }],
        name: 'Deathstrike - Follow-up',
        // Track the follow-up separately while retaining Deathstrike as the casting skill.
        damageBreakdownName: 'Deathstrike - Follow-up',
        sourceId: ID.DEATHSTRIKE_ID_28625,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1,
        atMs: 320
      }
    ])
  },
  [ID.DEATHSTRIKE_ID_28625]: {
    name: 'Deathstrike',
    icon: 'https://render.guildwars2.com/file/030BA607CA9D6A0D0E29F53C201421019263F353/1876877.png',
    weapon: 'Sword',
    slot: 'Weapon_5',
    // The second blow is automatic; retain its damage identity without offering another weapon input.
    type: 'Proc',
    rotationInputExcluded: true,
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.67,
        hits: 1,
        name: 'Deathstrike - Follow-up',
        damageBreakdownName: 'Deathstrike - Follow-up',
        actorType: ACTOR.PLAYER
      }
    ]
  }
};
