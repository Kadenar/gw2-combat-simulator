/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIRROR_STRIKES]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Mirage',
    castTimeMs: 1080,
    cooldown: 0,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 6,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.AXES_OF_SYMMETRY]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Mirage',
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        atMs: 920,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5,
        atMs: -80
      }
    ],
    quicknessCastTimeMs: 1000
  },
  [ID.LACERATING_CHOP]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Mirage',
    cooldown: 0,
    nextChainId: ID.ETHEREAL_CHOP,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 2,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 430
  },
  [ID.ETHEREAL_CHOP]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Mirage',
    quicknessCastTimeMs: 530,
    cooldown: 0,
    nextChainId: ID.MIRROR_STRIKES,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.LINGERING_THOUGHTS]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Mirage',
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Whirl',
        applications: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castEnd',
      atMs: 160
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 1,
        stacks: 3
      }
    ],
    quicknessCastTimeMs: 920
  },
  // Non-Mirage Axe variants retain separate IDs so their conditions and finishers resolve independently.
  [ID.TROUBADOUR_LINGERING_THOUGHTS]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Troubadour',
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Whirl',
        applications: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 1,
        stacks: 3
      }
    ],
    // The Troubadour variant keeps the same measured Axe cast timing as Mirage.
    quicknessCastTimeMs: 920
  },
  [ID.TROUBADOUR_AXES_OF_SYMMETRY]: {
    type: 'Weapon',
    weapon: 'Axe',
    specialization: 'Troubadour',
    cooldown: 8,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 1000
  }
});
