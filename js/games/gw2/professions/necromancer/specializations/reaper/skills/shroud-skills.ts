/**
 * Owns Reaper Shroud entry, exit, and weapon skill fragments.
 * Persistent shroud state remains in `mechanics/reaper-shroud.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies Reaper Shroud fragments to specialization composition. */
export const REAPER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LIFE_REND]: {
    castTimeMs: 400,
    effects: [{ type: 'strike', coefficient: 1.4, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper'
  },
  [ID.LIFE_SLASH]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper'
  },
  [ID.TERRIFY]: {
    castTimeMs: 320,
    effects: [{ type: 'control', controlKind: 'fear' }],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    cooldown: 0
  },
  [ID.INFUSING_TERROR]: {
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    // Custom: Arms or consumes the skill's timed follow-up flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'necromancer.flip'
  },
  [ID.LIFE_REAP]: {
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 1.5,
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper'
  },
  [ID.SOUL_SPIRAL]: {
    // Resolve Soul Spiral per packet so interruption keeps landed hits while cancelling only later packets.
    interruptMode: 'per-packet',
    castTimeMs: 2160,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 4,
            ambiguousFieldSelection: 'oldest'
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
          condition: 'Poisoned',
          stacks: 1,
          duration: 2
        }))
      }
    ]),
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'reaper',
    shroudSlot: 4,
    specialization: 'Reaper'
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    // The scythe commits after 920 ms, allowing its lingering Chill field to continue after interruption.
    interruptCommitMs: 920,
    castTimeMs: 1320,
    // EVTC places the strike and first Chill at 840 ms, followed by four fixed one-second field pulses.
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      ...impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 4,
          comboFields: [{ ownerId: 'necromancer', fieldType: 'Ice', duration: 4 }],
          coefficientModifiers: [
            { kind: 'target-health-below', threshold: 0.25, multiplier: 2 },
            { kind: 'target-health-below', threshold: 0.5, multiplier: 1.5 }
          ]
        },
        { type: 'control', controlKind: 'stun' }
      ]),
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'reaper',
    shroudSlot: 5,
    specialization: 'Reaper'
  },
  [ID.REAPERS_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Reaper',
    shroudEntry: 'reaper',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'necromancer.shroud'
  },
  [ID.DEATHS_CHARGE]: {
    castTimeMs: 1200,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      {
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
        { type: 'strike', coefficient: 1.625, name: "Death's Charge — Final Strike" },
        { type: 'blind' }
      ])
    ],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'reaper',
    shroudSlot: 2,
    specialization: 'Reaper'
  },
  [ID.EXIT_REAPERS_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Reaper',
    shroudExit: 'reaper',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'necromancer.shroud'
  }
});
