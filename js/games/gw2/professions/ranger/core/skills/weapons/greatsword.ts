/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Both Maul IDs share one strike and the same recharge and vulnerability application.
const maul: SkillFragment = {
  cooldown: 4,
  effects: [
    { type: 'strike', coefficient: 2.2, hits: 1 },
    { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
  ],
  quicknessCastTimeMs: 333
};

export const RANGER_CORE_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SLASH_ID_12474]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.HILT_BASH]: {
    cooldown: 20,
    handlerId: 'ranger.hilt-bash',
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      { type: 'control', controlKind: 'Daze' }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.SLICE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.ENDURING_SWING]: {
    resourceGain: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.76,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.SWOOP]: {
    cooldown: 10,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }]
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.COUNTERATTACK]: {
    effects: [],
    quicknessCastTimeMs: 2000
  },
  [ID.COUNTERATTACK_KICK]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.MAUL]: maul,
  [ID.MAUL_ID_46629]: maul
});
