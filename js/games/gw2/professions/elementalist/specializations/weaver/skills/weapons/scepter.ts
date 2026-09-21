/**
 * Scepter weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 scepter position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against castTimeMs and follow runtime skill variants through the shared scheduler policy.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * The six scepter dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Fire+Water. Single hit applying one condition from each element.
  [ID.FIERY_FROST]: {
    name: 'Fiery Frost',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 880,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 4, metadata: {} },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  // Fire+Air. Five equal 0.55 beam pulses across the cast (240/360/520/640/760
  // ms) with no conditions attached - pure strike damage split five ways.
  [ID.PLASMA_BEAM]: {
    name: 'Plasma Beam',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 920,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 240,
            coefficient: 0.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 640,
            coefficient: 0.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Earth. Two identical hits at 240 and 840 ms, each repeating the same
  // Burning plus three-stack Vulnerability payload.
  [ID.FRACTURING_STRIKE]: {
    name: 'Fracturing Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 920,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.2 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.2 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 8, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  // Air+Water. One heavy hit that bundles Chilled, self-Stability and a
  // crowd-control application on the same 480 ms packet.
  [ID.GLACIAL_DRIFT]: {
    name: 'Glacial Drift',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2, canCrit: true },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 4, metadata: {} },
      { type: 'boon', boon: 'Stability', stacks: 1, duration: 5, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ]),
    specialization: 'Weaver'
  },
  // Water+Earth. Eight 0.3 pulses on a 280 ms cadence from 760 ms to 2720 ms,
  // running well past the 600 ms cast; every pulse stacks Bleeding and
  // Vulnerability, but Cripple is applied once, on the first pulse only.
  [ID.STONE_TIDE]: {
    name: 'Stone Tide',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 4, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1600, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2160, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  // Air+Earth. Opening 1.4 hit at 440 ms, then a second 1.0 hit at 720 ms that
  // carries the crowd-control application.
  [ID.EARTHEN_SYNERGY]: {
    name: 'Earthen Synergy',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 1.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1, canCrit: true },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ])
    ],
    specialization: 'Weaver'
  }
});
