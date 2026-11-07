/**
 * Defines Weaver staff dual attacks in slot 3. Each skill declares an unordered attunement pair in
 * `attunement` and is available only when both elements are attuned. Effect offsets use castTimeMs and follow
 * runtime skill variants through the shared scheduler. This file contains declarations without handlers.
 */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * The six staff dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  // Fire+Water. One packet bundling the strike, the blind and self-Regeneration.
  [ID.PRESSURE_BLAST]: {
    name: 'Pressure Blast',
    icon: 'https://render.guildwars2.com/file/29744450A3E3DE28A142356DCF0B2BE805F2254D/1770353.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 650,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4,
        applications: 1
      },
      { type: 'boon', boon: BOON.REGENERATION, stacks: 1, duration: 4 }
    ])
  },
  [ID.PLASMA_BLAST]: {
    name: 'Plasma Blast',
    icon: 'https://render.guildwars2.com/file/0F69A473C09F0F4D05FBD45206423A42447D2A3E/1770351.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Air',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
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
    ]
  },
  // Fire+Earth. The only staff dual that lays a field: a four-second Fire field
  // opening at cast end, backed by an impact hit at 720 ms and then four
  // one-second `field-tick` pulses (1720-4720 ms), each stacking one second of
  // Burning. Named in the core Persisting Flames list, so that trait can extend
  // both the field and these tick packets.
  [ID.PYROCLASTIC_BLAST]: {
    name: 'Pyroclastic Blast',
    icon: 'https://render.guildwars2.com/file/03920A0BA342FF9BAEF0B19A4CEC6008D061F821/1770352.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire+Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 3 }
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
        timingScale: 'cast'
      }
    ]
  },
  // Air+Water. Three 0.25 hits at 280/640/1000 ms, but only the first carries
  // the payload, including eight stacks of Vulnerability, Chilled, and the crowd-control
  // application; the follow-ups are strike damage alone.
  [ID.MONSOON]: {
    name: 'Monsoon',
    icon: 'https://render.guildwars2.com/file/053E0AC705DE1718FF519DD6BE7A6B9FD9D8B53B/1770354.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Air+Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.25, canCrit: true },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 8 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4 },
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
    ]
  },
  // Water and Earth. Five one-second pulses occur from 1280 ms to 5280 ms,
  // after the 640 ms cast. Each pulse reapplies Cripple and Immobilize.
  [ID.LAHAR]: {
    name: 'Lahar',
    icon: 'https://render.guildwars2.com/file/063CA2E1A6EEA00EB1AADE09C80C77D5D8222EBA/1770350.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Water+Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
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
        }))
      },
      {
        type: 'condition',
        ticks: [1280, 2280, 3280, 4280, 5280].map((atMs) => ({
          atMs,
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.PILE_DRIVER]: {
    name: 'Pile Driver',
    icon: 'https://render.guildwars2.com/file/CBC14B1676240AAD01952ADCB591D1086020D97B/1770349.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Air+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 1320,
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

        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  }
};
