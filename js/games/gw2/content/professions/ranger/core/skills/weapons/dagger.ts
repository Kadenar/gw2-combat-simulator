/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CRIPPLING_TALON]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    quicknessCastTimeMs: 360
  },
  [ID.STALKERS_STRIKE]: {
    implemented: true,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 8
      }
    ],
    quicknessCastTimeMs: 760
  },
  [ID.LEADING_SWIPE]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.42,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 320
  },
  [ID.SERPENT_STAB]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.44,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 280
  },
  [ID.DOUBLE_ARC]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 2
      }
    ],
    recharge: 6,
    cooldown: 6,
    quicknessCastTimeMs: 600,
    // Double Arc arms the pet's next two attacks; the weapon hit does not poison directly.
    handlerId: 'ranger.poisonous-strikes'
  },
  [ID.DEADLY_DELIVERY]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 440
  },
  [ID.GROUNDWORK_GOUGE]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 280
  },
  [ID.INSTINCTIVE_ENGAGE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 8
      }
    ],
    recharge: 12,
    cooldown: 12,
    quicknessCastTimeMs: 840
  }
});
