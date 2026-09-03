/**
 * Owns Reaper shout skill fragments.
 * Reaper Shroud skill fragments live in `shroud-skills.ts`.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Supplies Reaper shout fragments to specialization composition. */
export const REAPER_SHOUT_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 2.5, hits: 1 },
      { type: 'control', controlKind: 'control' }
    ]
  },
  [ID.NOTHING_CAN_SAVE_YOU]: {
    castTimeMs: 500,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: 'Vulnerability', duration: 10, stacks: 6 }
    ]
  },
  [ID.CHILLED_TO_THE_BONE]: {
    castTimeMs: 1000,
    effects: [
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'control', controlKind: 'control' },
      { type: 'custom', eventType: 'necromancer.chill', event: { duration: 4 } }
    ]
  },
  [ID.YOUR_SOUL_IS_MINE]: {
    castTimeMs: 1000,
    effects: [{ type: 'strike', coefficient: 0.5, hits: 1 }],
    lifeForceGain: 15
  },
  [ID.SUFFER]: {
    castTimeMs: 0,
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
      { type: 'custom', eventType: 'necromancer.chill', event: { duration: 3 } }
    ],
    // Custom: Moves a skill-specific number of active self-conditions to the target; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.RISE]: {
    castTimeMs: 500,
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }]
  }
});
