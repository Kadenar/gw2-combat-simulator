/**
 * Reaper skill mechanics owned by the Reaper Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/specializations/reaper/profiles.js';

export const REAPER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.LIFE_REND]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'reaper',
    shroudSlot: 1,
    specialization: 'Reaper'
  },
  [ID.LIFE_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 600,
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
  [ID.NOTHING_CAN_SAVE_YOU]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 6
      }
    ]
  },
  [ID.TERRIFY]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    cooldown: 0
  },
  [ID.INFUSING_TERROR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'reaper',
    shroudSlot: 3,
    specialization: 'Reaper',
    handlerId: 'necromancer.flip'
  },
  [ID.CHILLED_TO_THE_BONE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 4
        }
      }
    ]
  },
  [ID.LIFE_REAP]: {
    implemented: true,
    quicknessCastTimeMs: 560,
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
  [ID.YOUR_SOUL_IS_MINE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ],
    lifeForceGain: 15
  },
  [ID.SOUL_SPIRAL]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 2160,
    effects: [
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
        ticks: [
          { atMs: 240, coefficient: 0.7 },
          { atMs: 440, coefficient: 0.7 },
          { atMs: 560, coefficient: 0.7 },
          { atMs: 760, coefficient: 0.7 },
          { atMs: 880, coefficient: 0.7 },
          { atMs: 1080, coefficient: 0.7 },
          { atMs: 1200, coefficient: 0.7 },
          { atMs: 1400, coefficient: 0.7 },
          { atMs: 1520, coefficient: 0.7 },
          { atMs: 1720, coefficient: 0.7 },
          { atMs: 1840, coefficient: 0.7 },
          { atMs: 2040, coefficient: 0.7 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 240, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 440, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 560, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 760, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 880, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1080, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1200, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1400, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1520, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1720, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 1840, condition: 'Poisoned', stacks: 1, duration: 2 },
          { atMs: 2040, condition: 'Poisoned', stacks: 1, duration: 2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'reaper',
    shroudSlot: 4,
    specialization: 'Reaper'
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 1320,
    // EVTC places the strike and first Chill at 840 ms, followed by four fixed one-second field pulses.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 840, coefficient: 4 }],
        comboFields: [{ ownerId: 'necromancer', fieldType: 'Ice', duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.25,
            multiplier: 2
          },
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      },
      {
        type: 'control',
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'stun'
        }
      },
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
  [ID.SUFFER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 3
        }
      }
    ],
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.RISE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.REAPERS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Reaper',
    shroudEntry: 'reaper',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 10,
    handlerId: 'necromancer.shroud'
  },
  [ID.DEATHS_CHARGE]: {
    implemented: true,
    quicknessCastTimeMs: 1200,
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
      {
        type: 'strike',
        ticks: [{ atMs: 1160, coefficient: 1.625 }],
        name: "Death's Charge — Final Strike",
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        atMs: 1160,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'reaper',
    shroudSlot: 2,
    specialization: 'Reaper'
  },
  [ID.EXIT_REAPERS_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Reaper',
    shroudExit: 'reaper',
    handlerId: 'necromancer.shroud'
  }
});
