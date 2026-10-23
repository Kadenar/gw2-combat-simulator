import { WEAPON, COMBO_FIELD, COMBO_FINISHER, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
/**
 * Staff weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 staff position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against castTimeMs and follow runtime skill variants through the shared scheduler policy.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * The six staff dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Fire+Water. One packet bundling the strike, the blind and self-Regeneration.
  [ID.PRESSURE_BLAST]: {
    name: 'Pressure Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 650,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4,
        applications: 1
      },
      { type: 'boon', boon: BOON.REGENERATION, stacks: 1, duration: 4, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.PLASMA_BLAST]: {
    name: 'Plasma Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 480,
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
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 3, metadata: {} }
      ]),
      {
        type: 'strike',
        coefficient: 0.4,
        damageKind: 'field-tick',
        atMs: 1720,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 1,
        atMs: 1720,
        applications: 4,
        intervalMs: 1000,
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
    weapon: WEAPON.STAFF,
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.25, canCrit: true },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 8, metadata: {} },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4, metadata: {} },
        { type: 'control', applications: 1, controlKind: CONTROL.KNOCKBACK }
      ]),
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
    weapon: WEAPON.STAFF,
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1280, 2280, 3280, 4280, 5280].map((atMs) => ({ atMs, coefficient: 0.25 }))
      },
      {
        type: 'condition',
        ticks: [1280, 2280, 3280, 4280, 5280].map((atMs) => ({
          atMs,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        })),
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [1280, 2280, 3280, 4280, 5280].map((atMs) => ({
          atMs,
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2
        })),
        metadata: {}
      }
    ]),
    specialization: 'Weaver'
  },
  [ID.PILE_DRIVER]: {
    name: 'Pile Driver',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 1320,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.1,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ],
        metadata: {},
        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ]),
    specialization: 'Weaver'
  }
});
