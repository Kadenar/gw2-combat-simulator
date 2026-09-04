/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHOP]: {
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.DOUBLE_CHOP]: {
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Double Chop — First Chop Damage'
      },
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Double Chop — Second Chop Damage'
      }
    ]
  },
  [ID.TRIPLE_CHOP]: {
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 2,
        atMs: 0
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Triple Chop — Final chop damage.'
      }
    ]
  },
  [ID.THROW_AXE]: {
    ammo: 2,
    ammoRecharge: 10,
    cooldown: 10,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.WHIRLING_AXE]: {
    interruptMode: 'per-packet',
    cooldown: 15,
    quicknessCastTimeMs: 2500,
    dualWieldCastTimeMs: 2040,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 15 }, (_, index) => ({
          atMs: 300 + index * 150,
          coefficient: 0.5592
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ]
  },
  [ID.DUAL_STRIKE]: {
    cooldown: 12,
    castTimeMs: 500,
    dualWieldCastTimeMs: 400,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.35,
        hits: 2,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CYCLONE_AXE]: {
    cooldown: 6,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 1.76,
        hits: 2,
        atMs: 0,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8
      }
    ]
  }
});
