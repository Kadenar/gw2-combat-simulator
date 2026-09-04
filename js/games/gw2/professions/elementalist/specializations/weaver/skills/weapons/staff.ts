/**
 * Staff weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 staff position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against the quickened timeline given by `quicknessCastTimeMs` and
 * are scaled back out for slower casts by the cast-scaled scheduler policy.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * The six staff dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
export const WEAVER_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Fire+Water. One packet bundling the strike, the blind and self-Regeneration.
  [ID.PRESSURE_BLAST]: {
    name: 'Pressure Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 650,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 600,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.PLASMA_BLAST]: {
    name: 'Plasma Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1.66
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Earth. The only staff dual that lays a field: a four-second Fire field
  // opening at cast end, backed by an impact hit at 720 ms and then four
  // one-second `field-tick` pulses (1720-4720 ms), each stacking one second of
  // Burning. Named in the core Persisting Flames list, so that trait can extend
  // both the field and these tick packets.
  [ID.PYROCLASTIC_BLAST]: {
    name: 'Pyroclastic Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1720,
            coefficient: 0.4,
            damageKind: 'field-tick'
          },
          {
            atMs: 2720,
            coefficient: 0.4,
            damageKind: 'field-tick'
          },
          {
            atMs: 3720,
            coefficient: 0.4,
            damageKind: 'field-tick'
          },
          {
            atMs: 4720,
            coefficient: 0.4,
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
            atMs: 1720,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 2720,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 3720,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 4720,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  // Air+Water. Three 0.25 hits at 280/640/1000 ms, but only the first carries
  // the payload - eight stacks of Vulnerability, Chilled and the crowd-control
  // application; the follow-ups are strike damage alone.
  [ID.MONSOON]: {
    name: 'Monsoon',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Vulnerability',
            stacks: 8,
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
            atMs: 280,
            condition: 'Chilled',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 280,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 640,
            coefficient: 0.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Water+Earth. Five one-second pulses from 1280 ms to 5280 ms - all of them
  // after the 640 ms cast - each re-applying Cripple and Immobilize.
  [ID.LAHAR]: {
    name: 'Lahar',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1280,
            coefficient: 0.25
          },
          {
            atMs: 2280,
            coefficient: 0.25
          },
          {
            atMs: 3280,
            coefficient: 0.25
          },
          {
            atMs: 4280,
            coefficient: 0.25
          },
          {
            atMs: 5280,
            coefficient: 0.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1280,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2280,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3280,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4280,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5280,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
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
            atMs: 1280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5280,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  [ID.PILE_DRIVER]: {
    name: 'Pile Driver',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1320,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1160,
            coefficient: 2.1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 1160,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ],
    specialization: 'Weaver'
  }
});
