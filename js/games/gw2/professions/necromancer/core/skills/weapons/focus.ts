import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPINAL_SHIVERS]: {
    castTimeMs: 800,
    effects: [
      {
        type: 'strike',
        // Use the zero-boon strike until target boon removal is simulated.
        coefficient: 2.5,
        hits: 1,
        name: 'Spinal Shivers'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.SOUL_GRASP]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'condition',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'condition.applied',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => event.sourceId === event.skillId,
            do: lifeForceGrant({ id: 'life-force', unit: 'application', grant: { percent: 11 } })
          }
        ],
        condition: 'Vulnerability',
        duration: 6,
        stacks: 5
      }
    ]
  }
});
