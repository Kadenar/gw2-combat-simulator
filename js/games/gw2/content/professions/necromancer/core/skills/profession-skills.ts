/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

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
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: 222 + index * 222, coefficient: 3.825 / 9 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 222, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 444, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 666, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 888, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1110, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1332, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1554, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1776, condition: 'Bleeding', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1998, condition: 'Bleeding', stacks: 1, duration: 3 }],
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
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 3
        }
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
        ticks: [{ atMs: 1750, coefficient: 0 }],
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
        ticks: [{ atMs: 2750, coefficient: 0 }],
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
        ticks: [{ atMs: 3750, coefficient: 0 }],
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
        ticks: [{ atMs: 4750, coefficient: 0 }],
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
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 4
        }
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
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 200, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1250, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2250, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3250, condition: 'Torment', stacks: 2, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4250, coefficient: 1.25 }],
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
