/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.VICIOUS_SHOT]: {
    name: 'Vicious Shot',
    icon: 'https://render.guildwars2.com/file/1DDAE693CAB780E7000BAED0973E0E485CCE9709/2479403.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65 },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 1, duration: 3.5 }
    ])
  },
  [ID.WEEPING_SHOTS]: {
    name: 'Weeping Shots',
    icon: 'https://render.guildwars2.com/file/A5E9C936EBF4F44D09CF08AAF52D0D7D220E2AD5/2479407.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 840,
    // Interruption preserves landed packets and cancels the remaining shots.
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Both conditions follow each bullet so partial casts and condition-triggered rewards use landed shots.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Each landed bullet grants its share; misses and interrupted shots earn nothing.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 1.5 } })]
          }
        ],
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'condition',
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 4
        }))
      },
      {
        type: 'condition',
        ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 6
        }))
      }
    ])
  },
  [ID.VILE_BLAST]: {
    name: 'Vile Blast',
    icon: 'https://render.guildwars2.com/file/35F00F2A4694E8FE05B2B7E2765B78C207EE28AF/2479404.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 600,
    // Committed casts retain the full lockout so cancelling cannot skip the aftercast.
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 4 } })]
          }
        ],
        coefficient: 1
      },
      { type: 'condition', condition: CONDITION.POISONED, stacks: 5, duration: 6 },
      { type: 'control', controlKind: CONTROL.STUN }
    ])
  }
};
