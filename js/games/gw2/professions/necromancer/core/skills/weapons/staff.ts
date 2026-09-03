/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NECROTIC_GRASP]: {
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ],
    lifeForceGain: 4,
    // Custom: Applies the skill's self-condition and Master of Corruption/Plague Sending rules; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.corruption'
  },
  [ID.CHILLBLAINS]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 8
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 4
        }
      }
    ]
  },
  [ID.REAPERS_MARK]: {
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'fear'
      }
    ]
  },
  [ID.PUTRID_MARK]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1
      }
    ],
    // Custom: Moves a skill-specific number of active self-conditions to the target; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.MARK_OF_BLOOD]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      }
    ]
  }
});
