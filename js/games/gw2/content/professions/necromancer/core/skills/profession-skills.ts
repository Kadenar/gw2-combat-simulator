/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LIFE_BLAST]: {
    implemented: true,
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
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    shroudEntry: 'death',
    shroudProfileId: PROFILE.shroud,
    minimumShroudLifeForcePercent: 10,
    handlerId: 'necromancer.shroud'
  },
  [ID.END_DEATH_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    shroudExit: 'death',
    handlerId: 'necromancer.shroud'
  },
  [ID.DOOM]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'death',
    shroudSlot: 3,
    specialization: ''
  },
  [ID.LIFE_TRANSFER]: {
    implemented: true,
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
    implemented: true,
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
    handlerId: 'necromancer.flip'
  },
  [ID.GRIM_SPECTER]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        metadata: {
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1750, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        metadata: {
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2750, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        metadata: {
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3750, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        metadata: {
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 4750, coefficient: 0 }],
        name: 'Grim Specter — Life Steal',
        metadata: {
          flatStrikeBase: 778,
          flatStrikePowerCoeff: 0.2,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIPPLE_OF_HORROR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ],
    handlerId: 'necromancer.flip'
  },
  [ID.DEATHLY_CLAWS]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    handlerId: 'necromancer.summon-madness'
  },
  [ID.DHUUMFIRE_BLAST]: {
    implemented: true,
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
    implemented: true,
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
  [ID.MANIFEST_SAND_SHADE_ID_42297]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.666,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2
      }
    ],
    simulatorAliasOfId: 44946,
    simulatorExcluded: true,
    flipSkillId: null
  },
  [ID.MARCH_OF_UNDEATH]: {
    implemented: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.MANIFEST_SAND_SHADE_ID_46473]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.666,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2
      }
    ],
    simulatorAliasOfId: 44946,
    simulatorExcluded: true,
    flipSkillId: null
  },
  [ID.MANIFEST_SAND_SHADE_ID_46474]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.666,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2
      }
    ],
    simulatorAliasOfId: 44946,
    simulatorExcluded: true,
    flipSkillId: null
  },
  [ID.DARK_PURSUIT]: {
    implemented: true,
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
