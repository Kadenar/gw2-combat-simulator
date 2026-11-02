/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines non-Holosmith Engineer sword timing, damage, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.SUN_EDGE_NON_HOLOSMITH]: {
    name: 'Sun Edge',
    icon: 'https://render.guildwars2.com/file/136E9A23E326BE1D67FAD6793A6253024204A6E5/1770405.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 440,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.96,
        hits: 1,
        name: 'Sun Edge (non-holosmith)',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SUN_RIPPER_NON_HOLOSMITH]: {
    name: 'Sun Ripper',
    icon: 'https://render.guildwars2.com/file/004244480A0828CE033FB575C8FA3A566A016C58/1770406.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.02,
        hits: 1,
        name: 'Sun Ripper (non-holosmith)',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.GLEAM_SABER_NON_HOLOSMITH]: {
    name: 'Gleam Saber',
    icon: 'https://render.guildwars2.com/file/DA9AC63DCF633A5D2806C37EB5C0E105C01DD7AC/1770407.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 720,
    // Commit the strike and recharge at 600 ms while retaining the full cast lockout.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.65 }],
        name: 'Gleam Saber (non-holosmith)',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER
      }
    ],
    // A committed finisher reduces live sword recharge, including shortened casts.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.sword-recharge', amount: 1 } }]
  },
  [ID.REFRACTION_CUTTER_NON_HOLOSMITH]: {
    name: 'Refraction Cutter',
    icon: 'https://render.guildwars2.com/file/C571A742D055DCA81F6FD70D38C0409DDC9ABEE5/1770408.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Refraction Cutter (non-holosmith) — Packet 1',
        actorType: ACTOR.PLAYER
      },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: [40, 80].map((atMs) => ({ atMs, coefficient: 0.8 / 2 })),
          name: 'Refraction Cutter Blade',
          // Report projectile damage separately while retaining the parent sword cast.
          damageBreakdownName: 'Refraction Cutter Blade',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ],
          projectile: true
        },
        {
          type: 'condition',
          ticks: [40, 80].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 4 })),
          actorType: ACTOR.PLAYER
        }
      ])
    ]
  },
  [ID.RADIANT_ARC_NON_HOLOSMITH]: {
    name: 'Radiant Arc',
    icon: 'https://render.guildwars2.com/file/A57A38790F3B7AE905B60AB2E172DC0C437125EA/1770409.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 14,
    castTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc (non-holosmith)',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 3,
        stacks: 1
      }
    ]
  }
};

// Core variants remain distinct from the elite specialization weapon identities.
export const NON_HOLOSMITH_SWORD_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.SUN_EDGE_NON_HOLOSMITH,
  ID.SUN_RIPPER_NON_HOLOSMITH,
  ID.GLEAM_SABER_NON_HOLOSMITH,
  ID.RADIANT_ARC_NON_HOLOSMITH,
  ID.REFRACTION_CUTTER_NON_HOLOSMITH
]);
