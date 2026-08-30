/** Weaver Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../data/ids.js';
import type { Skill, SkillFragment } from '../../../../../../platform/engine/types.js';
import { isElementalistAttunement, type ElementalistAttunement } from '../../../core/state.js';
import { WEAVER_DAGGER_SKILL_MECHANICS } from './weapons/dagger.js';
import { WEAVER_HAMMER_SKILL_MECHANICS } from './weapons/hammer.js';
import { WEAVER_PISTOL_SKILL_MECHANICS } from './weapons/pistol.js';
import { WEAVER_SCEPTER_SKILL_MECHANICS } from './weapons/scepter.js';
import { WEAVER_SPEAR_SKILL_MECHANICS } from './weapons/spear.js';
import { WEAVER_STAFF_SKILL_MECHANICS } from './weapons/staff.js';
import { WEAVER_SWORD_SKILL_MECHANICS } from './weapons/sword.js';

/** Parses the canonical skill metadata for a valid pair of distinct Weaver attunements. */
export function weaverDualAttunements(skill: Skill): readonly [ElementalistAttunement, ElementalistAttunement] | null {
  const parts = String(skill.attunement || '').split('+');
  if (parts.length !== 2) return null;

  const [first, second] = parts;
  if (!isElementalistAttunement(first) || !isElementalistAttunement(second) || first === second) return null;
  return [first, second];
}

// Composes dual-weapon fragments with Weaver profession, utility, heal, and elite skills.
export const WEAVER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...WEAVER_DAGGER_SKILL_MECHANICS,
  ...WEAVER_HAMMER_SKILL_MECHANICS,
  ...WEAVER_PISTOL_SKILL_MECHANICS,
  ...WEAVER_SCEPTER_SKILL_MECHANICS,
  ...WEAVER_SPEAR_SKILL_MECHANICS,
  ...WEAVER_STAFF_SKILL_MECHANICS,
  ...WEAVER_SWORD_SKILL_MECHANICS,
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
    implemented: true,
    effects: []
  },
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
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
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
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
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
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
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
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 1000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 5000,
            coefficient: 0.33,
            metadata: {
              damageKind: 'field-tick'
            }
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
    preservesAutoattackChain: true,
    implemented: true,
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
    implemented: true,
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
        metadata: {
          controlKind: 'crowd-control'
        }
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
    implemented: true,
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
    implemented: true,
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
