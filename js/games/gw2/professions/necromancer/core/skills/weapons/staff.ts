/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.NECROTIC_GRASP]: {
    name: 'Necrotic Grasp',
    description: 'Send out a grasping hand that damages foes in a line and grants you life force.',
    icon: 'https://render.guildwars2.com/file/DB3E59E3A05011265E91A3591951A26B07E52ADA/103565.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 880,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 4 } })
          }
        ],
        coefficient: 1,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      }
    ]
  },
  [ID.MARK_OF_BLOOD]: {
    name: 'Mark of Blood',
    description: 'Mark. Inscribe a mark that bleeds foes when they trigger it, and grants regeneration to allies.',
    icon: 'https://render.guildwars2.com/file/F205B3A517DF27E3323D2FBCFE6C0FA3430242F9/103813.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    skillFamily: 'Mark',
    cooldown: 4.8,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 8
      }
    ]
  },
  [ID.CHILLBLAINS]: {
    name: 'Chillblains',
    description: 'Mark. Inscribe a mark that inflicts chill and poison on foes when triggered.',
    icon: 'https://render.guildwars2.com/file/A33F6E0F51AD229AD57ED83D7AC040225DFD0FEA/103138.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    skillFamily: 'Mark',
    cooldown: 12,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 2,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.PUTRID_MARK]: {
    name: 'Putrid Mark',
    description: 'Mark. Inscribe a mark that damages enemies and transfers your conditions to them when triggered.',
    icon: 'https://render.guildwars2.com/file/DF024691B5A2CD0D78CDF3EAEB0394F878FD6EC4/103814.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    skillFamily: 'Mark',
    cooldown: 15,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 3,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.transfer' }
          }
        ],
        coefficient: 1.32,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      }
    ]
  },
  [ID.REAPERS_MARK]: {
    name: "Reaper's Mark",
    description: 'Mark. Inscribe a mark that inflicts fear on foes when triggered.',
    icon: 'https://render.guildwars2.com/file/0D7FDAA90B6C043A31333E630C55C8547CC09EC2/103821.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    skillFamily: 'Mark',
    cooldown: 18,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1
      }
    ]
  }
});
