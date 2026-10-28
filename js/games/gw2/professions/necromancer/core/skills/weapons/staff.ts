/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.NECROTIC_GRASP]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
