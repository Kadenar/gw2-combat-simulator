/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LIFE_BLAST]: {
    quicknessCastTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    specialization: '',
    flipSkillId: null
  },
  [ID.DEATH_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    shroudEntry: 'death',
    shroudProfileId: PROFILE.shroud,
    minimumShroudLifeForcePercent: 10,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.END_DEATH_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    shroudExit: 'death',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.shroud'
  },
  [ID.DOOM]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'fear'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'death',
    shroudSlot: 3,
    specialization: ''
  },
  [ID.LIFE_TRANSFER]: {
    quicknessCastTimeMs: 2920,
    // Snap each original 222 ms pulse independently to 40 ms, keeping strikes and bleeding synchronized.
    effects: [
      {
        type: 'strike',
        ticks: [240, 440, 680, 880, 1120, 1320, 1560, 1760, 2000].map((atMs) => ({ atMs, coefficient: 3.825 / 9 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 240, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 680, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 880, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1120, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1320, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1560, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1760, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2000, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'death',
    shroudSlot: 4,
    specialization: '',
    lifeForceGain: 9
  },
  [ID.DARK_PATH]: {
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3
      }
    ],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    specialization: '',
    // Custom: Arms or consumes the skill's timed follow-up flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'necromancer.flip'
  },
  [ID.GRIM_SPECTER]: {
    castTimeMs: 750,
    // Align delayed siphons to 40 ms while preserving their one-second cadence.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1760, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2760, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3760, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4760, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        flatStrikeBase: 778,
        flatStrikePowerCoeff: 0.2,
        noCrit: true,
        damageKind: 'life-steal',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIPPLE_OF_HORROR]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'fear'
      }
    ],
    // Custom: Arms or consumes the skill's timed follow-up flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'necromancer.flip'
  },
  [ID.DEATHLY_CLAWS]: {
    castTimeMs: 1100,
    effects: [
      {
        type: 'strike',
        coefficient: 2.34,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 3
      }
    ]
  },
  [ID.LICHS_GAZE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 4
      }
    ],
    cooldown: 8
  },
  [ID.SUMMON_MADNESS]: {
    castTimeMs: 1500,
    summons: 8,
    summonInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 0.33 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon',
        packetLabel: 'attack',
        name: 'Unstable Horror - Attack'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 6000, coefficient: 1.25 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon',
        packetLabel: 'explosion',
        name: 'Unstable Horror - Explosion'
      }
    ],
    // Custom: Summons the temporary minions and schedules their attacks/expiry; see `core/mechanics/minions.ts`.
    handlerId: 'necromancer.summon-madness'
  },
  [ID.DHUUMFIRE_BLAST]: {
    quicknessCastTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3
      }
    ],
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'death',
    shroudSlot: 1,
    specialization: '',
    flipParentId: null,
    simulatorExcluded: true
  },
  [ID.TAINTED_SHACKLES]: {
    castTimeMs: 250,
    // Align the delayed torment and final strike to 40 ms without shifting the cast-scaled opening pulse.
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 200, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1240, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2240, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3240, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4240, coefficient: 1.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'death',
    shroudSlot: 5,
    specialization: ''
  },
  [ID.MARCH_OF_UNDEATH]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.DARK_PURSUIT]: {
    castTimeMs: 0,
    effects: [],
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'death',
    shroudSlot: 2,
    specialization: '',
    cooldown: 0
  }
});
