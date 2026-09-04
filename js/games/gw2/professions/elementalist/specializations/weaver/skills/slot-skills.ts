/**
 * Owns Weaver stance, profession, heal, and elite skill fragments.
 * Dual-weapon fragments remain under `skills/weapons/`.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Declares Weaver-owned non-weapon skills for composition by `index.ts`. */
export const WEAVER_SLOT_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.AQUATIC_STANCE]: {
    name: 'Aquatic Stance',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Weaver',
    categories: ['Stance'],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Stance',
    effects: []
  },
  // The four Primordial Stance variants are authored with static per-element
  // pulses; the Weaver afterCast hook cancels those and reschedules each tick so
  // the pulse follows the attunement pair that is live when it lands.
  [ID.PRIMORDIAL_STANCE_FIRE]: {
    name: 'Primordial Stance (Fire)',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement: 'Fire',
    categories: ['Stance'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 1000,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2000,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3000,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4000,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5000,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.PRIMORDIAL_STANCE_WATER]: {
    name: 'Primordial Stance (Water)',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement: 'Water',
    categories: ['Stance'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 1000,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 2000,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 3000,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 4000,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 5000,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.PRIMORDIAL_STANCE_AIR]: {
    name: 'Primordial Stance (Air)',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement: 'Air',
    categories: ['Stance'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          },
          {
            atMs: 1000,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          },
          {
            atMs: 2000,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          },
          {
            atMs: 3000,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          },
          {
            atMs: 4000,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          },
          {
            atMs: 5000,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.PRIMORDIAL_STANCE_EARTH]: {
    name: 'Primordial Stance (Earth)',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement: 'Earth',
    categories: ['Stance'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            damageKind: 'field-tick'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          },
          {
            atMs: 1000,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          },
          {
            atMs: 2000,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          },
          {
            atMs: 3000,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          },
          {
            atMs: 4000,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          },
          {
            atMs: 5000,
            condition: 'Bleeding',
            stacks: 2,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    name: 'Weave Self',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    quicknessCastTimeMs: 800,
    cooldown: 90,
    nextChainId: ID.TAILORED_VICTORY,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    nextChainId: ID.WEAVE_SELF,
    skillFamily: 'Stance',
    // Tailored Victory consumes the Perfect Weave flip window when it completes.
    mechanicTriggers: [
      {
        type: 'elementalist.weaver.consume-perfect-weave',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.UNRAVEL]: {
    name: 'Unravel',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Weaver',
    categories: ['Stance'],
    mechanicSlot: 5,
    quicknessCastTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.FERVENT_STANCE]: {
    name: 'Fervent Stance',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    categories: ['Stance'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Stance',
    // Fervent Stance arms its dual-attack might window after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.weaver.arm-fervent-stance',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 6,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 6,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Quickness',
        stacks: 1,
        duration: 6,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
