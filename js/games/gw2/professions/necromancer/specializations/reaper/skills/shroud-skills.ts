/**
 * Owns Reaper Shroud entry, exit, and weapon skill fragments.
 * Shroud attribute modifiers live in `modifiers.ts`; shroud state and reactions live in `hooks.ts` and `mechanics/shroud-effects.ts`.
 */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Supplies Reaper Shroud fragments to specialization composition. */
export const REAPER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LIFE_REND]: {
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper',
    castTimeMs: 400,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      }
    ]
  },
  [ID.LIFE_SLASH]: {
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper',
    castTimeMs: 600,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIFE_REAP]: {
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper',
    castTimeMs: 560,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 1.5 } })
          }
        ],
        ticks: [{ atMs: 280, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DEATHS_CHARGE]: {
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'reaper',
    shroudSlot: 2,
    specialization: 'Reaper',
    castTimeMs: 1200,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        ticks: [
          { atMs: 40, coefficient: 0.25 },
          { atMs: 160, coefficient: 0.25 },
          { atMs: 280, coefficient: 0.25 },
          { atMs: 400, coefficient: 0.25 },
          { atMs: 520, coefficient: 0.25 },
          { atMs: 640, coefficient: 0.25 },
          { atMs: 760, coefficient: 0.25 },
          { atMs: 880, coefficient: 0.25 },
          { atMs: 960, coefficient: 0.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          weaponStrengthProfileId: 'transform.reaper-shroud',
          type: 'strike',
          coefficient: 1.625,
          name: "Death's Charge — Final Strike"
        },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3
        }
      ])
    ]
  },
  [ID.INFUSING_TERROR]: {
    flipDuration: 6,
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    castTimeMs: 0,
    effects: [],
    // A completed cast arms the authored follow-up duration through the common flip owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.TERRIFY } }]
  },
  [ID.TERRIFY]: {
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    cooldown: 0,
    castTimeMs: 320,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.TERRIFY } }]
  },
  [ID.SOUL_SPIRAL]: {
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'reaper',
    shroudSlot: 4,
    specialization: 'Reaper',
    castTimeMs: 2160,
    // Resolve Soul Spiral per packet so interruption keeps landed hits while cancelling only later packets.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.reaper-shroud',
        type: 'strike',
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: COMBO_FINISHER.WHIRL,
            applications: 4
          }
        ],
        ticks: [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040].map((atMs) => ({
          atMs,
          coefficient: 0.7
        }))
      },
      {
        type: 'condition',
        ticks: [240, 440, 560, 760, 880, 1080, 1200, 1400, 1520, 1720, 1840, 2040].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.REAPERS_SHROUD]: {
    cooldown: 10,
    specialization: 'Reaper',
    shroudEntry: 'reaper',
    shroudTuning: { kind: 'trait', id: TRAIT.SHROUD_KNIGHT },
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }]
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'reaper',
    shroudSlot: 5,
    specialization: 'Reaper',
    castTimeMs: 1320,
    // The scythe commits after 920 ms, allowing its lingering Chill field to continue after interruption.
    interruptCommitMs: 920,
    // EVTC places the strike and first Chill at 840 ms, followed by four fixed one-second field pulses.
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      ...impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          weaponStrengthProfileId: 'transform.reaper-shroud',
          type: 'strike',
          coefficient: 4,
          comboFields: [{ ownerId: 'necromancer', fieldType: COMBO_FIELD.ICE, duration: 4 }],
          coefficientModifiers: [
            { kind: 'target-health-below', threshold: 0.25, multiplier: 2 },
            { kind: 'target-health-below', threshold: 0.5, multiplier: 1.5 }
          ]
        },
        { type: 'control', controlKind: CONTROL.STUN }
      ]),
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: CONDITION.CHILLED,
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.EXIT_REAPERS_SHROUD]: {
    cooldown: 0,
    specialization: 'Reaper',
    shroudExit: 'reaper',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  }
});
