/**
 * Spear weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 spear position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Unlike the other Weaver weapons, every spear dual is instant: each entry has
 * a 0 ms cast and lands its whole payload in one packet at offset 0, so cast
 * scaling never moves these effects.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/**
 * The six spear dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
export const WEAVER_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Fire+Water. The only spear dual that grants an aura: `aura: 'Fire|3'` is
  // read by the core cast hook as a three-second Fire Aura on cast end.
  [ID.FROSTFIRE_WARD]: {
    name: 'Frostfire Ward',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    aura: 'Fire|3',
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Air. Heaviest single spear packet, paired with self superspeed and
  // three stacks of Might rather than any condition.
  [ID.GALVANIZE]: {
    name: 'Galvanize',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 2.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 6,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Earth. Blast finisher into the oldest ambiguous field, plus Burning
  // and three stacks of Bleeding.
  [ID.FIERY_IMPACT]: {
    name: 'Fiery Impact',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.75,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
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
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Bleeding',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.ELUTRIATE]: {
    name: 'Elutriate',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.25
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
            stacks: 5,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Chilled',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  // Water+Earth. Modelled purely as a Blast finisher: one strike, no conditions
  // and no boons.
  [ID.SOOTHING_BURST]: {
    name: 'Soothing Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  [ID.SHALE_STORM]: {
    name: 'Shale Storm',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Cripple',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  }
});
