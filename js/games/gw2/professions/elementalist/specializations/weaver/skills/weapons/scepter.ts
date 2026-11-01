/**
 * Scepter weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 scepter position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every definition names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against castTimeMs and follow runtime skill variants through the shared scheduler policy.
 */
import { BOON, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * The six scepter dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Fire+Water. Single hit applying one condition from each element.
  [ID.FIERY_FROST]: {
    name: 'Fiery Frost',
    description: 'Dual Attack. Launch a fire-and-ice bolt while evading and removing movement-impairing conditions.',
    icon: 'https://render.guildwars2.com/file/6DBA0EA2450E7930C4FDE4712ADD917D3B0414CF/1770347.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire+Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 880,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.1 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
    ])
  },
  // Fire+Air. Five equal 0.55 beam pulses across the cast (240/360/520/640/760
  // ms) with no conditions attached - pure strike damage split five ways.
  [ID.PLASMA_BEAM]: {
    name: 'Plasma Beam',
    description: 'Dual Attack. Fire a superheated jet of plasma at your foe.',
    icon: 'https://render.guildwars2.com/file/F3801A70180946B60E5F14A174BEBA15E106B60A/1770345.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire+Air',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 920,
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
    ]
  },
  // Fire+Earth. Two identical hits at 240 and 840 ms, each repeating the same
  // Burning plus three-stack Vulnerability payload.
  [ID.FRACTURING_STRIKE]: {
    name: 'Fracturing Strike',
    description: 'Dual Attack. Call a meteor from the sky that crashes to the ground, creating an eruption of magma.',
    icon: 'https://render.guildwars2.com/file/D21E4445D1AEF49966EC58499A602C4F6A12ADA4/1770346.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Fire+Earth',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 920,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.2 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 3, duration: 8 }
      ]),
      ...impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.2 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 3, duration: 8 }
      ])
    ]
  },
  // Air+Water. One heavy hit that bundles Chilled, self-Stability and a
  // crowd-control application on the same 480 ms packet.
  [ID.GLACIAL_DRIFT]: {
    name: 'Glacial Drift',
    description:
      'Dual Attack. Whirl air and ice together, sending out a supercooled projectile that chills enemies it strikes.',
    icon: 'https://render.guildwars2.com/file/5C042406C722ADE9F213EFBECBE8612CCB3DE7FC/1770348.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Air+Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2, canCrit: true },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4 },
      { type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  // Water+Earth. Eight 0.3 pulses on a 280 ms cadence from 760 ms to 2720 ms,
  // running well past the 600 ms cast; every pulse stacks 3 s Bleeding and
  // Vulnerability
  // but Cripple is applied once, on the first pulse only.
  [ID.STONE_TIDE]: {
    name: 'Stone Tide',
    description:
      'Dual Attack. Bleed your foe with ice and sharpened stones. The first pulse of this skill cripples enemies.',
    icon: 'https://render.guildwars2.com/file/44DA33C8D9B5A021615870B8E1E6FE02447E2D0A/1770344.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Water+Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    effects: [
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
      ]),
      ...impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 1600, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 1880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 2160, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 2440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 2720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 3 }
      ])
    ]
  },
  // Air+Earth. Opening 1.4 hit at 440 ms, then a second 1.0 hit at 720 ms that
  // carries the crowd-control application.
  [ID.EARTHEN_SYNERGY]: {
    name: 'Earthen Synergy',
    description:
      'Dual Attack. Smite your enemies with the earth and sky, dealing damage from below and then stunning from above.',
    icon: 'https://render.guildwars2.com/file/DE0FEF37F771955D1A2D18BD0B7C7D6A3EA209B9/1770343.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SCEPTER,
    attunement: 'Air+Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
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
        { type: 'control', applications: 1, controlKind: CONTROL.STUN }
      ])
    ]
  }
});
