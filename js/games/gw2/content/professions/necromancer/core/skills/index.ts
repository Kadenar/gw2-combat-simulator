/**
 * Core skill mechanics owned by the Core Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../../data/ids.js';
import type { Skill, SkillFragment } from '../../../../../platform/engine/types.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

// Sword timings use stable Quickness EVTC clusters, while temporary reactivations retain their measured game windows.
const OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS = 3;

export const NECROMANCER_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WELL_OF_BLOOD]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.GHASTLY_CLAWS]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 1440,
    effects: [
      {
        type: 'strike',
        coefficient: 4.6,
        hits: 8,
        atMs: 180,
        intervalMs: 180,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 12
  },
  [ID.DARK_PACT]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 10,
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Dark Pact grants 5% life force only after ripping a boon; its impact handler owns the self-bleed and immobilize.
    lifeForceGain: 5,
    handlerId: 'necromancer.dark-pact'
  },
  [ID.GRASPING_DEAD]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SUMMON_BONE_FIEND]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    rechargeOnMinionDeath: true,
    handlerId: 'necromancer.minion'
  },
  [ID.PUTRID_EXPLOSION]: {
    implemented: true,
    castTimeMs: 500,
    minionKey: 'bone-minion',
    consumes: 1,
    effects: [
      { type: 'strike', coefficient: 1, hits: 1, actorType: 'summon' },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ],
    handlerId: 'necromancer.minion-command'
  },
  [ID.SUMMON_BONE_MINIONS]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    rechargeOnMinionDeath: true,
    handlerId: 'necromancer.minion'
  },
  [ID.BLOOD_IS_POWER]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    // Blood Is Power cannot cancel its remaining aftercast, so importers and the scheduler retain the full cast lane.
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 15,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    handlerId: 'necromancer.corruption'
  },
  [ID.WELL_OF_CORRUPTION]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    lifeForceGain: 1
  },
  [ID.WELL_OF_SUFFERING]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 6,
        hits: 6,
        atMs: 280,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 5,
        stacks: 2
      }
    ]
  },
  [ID.SUMMON_BLOOD_FIEND]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    handlerId: 'necromancer.minion'
  },
  [ID.CONSUME_CONDITIONS]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    handlerId: 'necromancer.corruption'
  },
  [ID.PLAGUELANDS]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 3.51,
        hits: 9,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 8,
        applications: 9,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 5,
        applications: 8,
        atMs: 2000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        applications: 7,
        atMs: 3000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 4000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 5000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 6000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 7000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 8000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1,
        atMs: 9000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        applications: 5,
        atMs: 5000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        applications: 4,
        atMs: 6000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'blind',
        applications: 3,
        atMs: 7000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {
          duration: 3
        }
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        applications: 2,
        atMs: 8000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10,
        atMs: 9000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    handlerId: 'necromancer.corruption'
  },
  [ID.LICH_FORM]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    lifeForceGain: 15,
    cooldown: 120,
    handlerId: 'necromancer.lich'
  },
  [ID.PUTRID_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
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
  [ID.SPINAL_SHIVERS]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1,
        name: 'Spinal Shivers — Damage—Three Boons'
      },
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 1,
        name: 'Spinal Shivers — Damage—Two Boons'
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Spinal Shivers — Damage—One Boon'
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Spinal Shivers — Damage—No Boons'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 5
        }
      }
    ]
  },
  [ID.WAIL_OF_DOOM]: {
    implemented: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 0,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 500,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 1000,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 1500,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 2000,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 2500,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 3000,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 3500,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 4000,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 4500,
        name: 'Locust Swarm — Life Siphon',
        metadata: {
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal'
        },
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    lifeForceGain: 1.5
  },
  [ID.RENDING_CLAWS]: {
    implemented: true,
    quicknessCastTimeMs: 620,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 7,
        stacks: 2
      }
    ]
  },
  [ID.PLAGUE_SIGNET]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.RIGOR_MORTIS]: {
    implemented: true,
    castTimeMs: 0,
    minionKey: 'bone-fiend',
    controlWindow: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.25,
            sourceId: 3634,
            name: 'Rigor Mortis - Bone Shard',
            controlKind: 'immobilize',
            controlDuration: 2,
            comboFinishers: [
              {
                ownerId: 'necromancer',
                finisherType: 'Projectile',
                chance: 1,
                ambiguousFieldSelection: 'oldest'
              }
            ]
          },
          {
            atMs: 760,
            coefficient: 0.25,
            sourceId: 3634,
            name: 'Rigor Mortis - Bone Shard',
            controlKind: 'immobilize',
            controlDuration: 2,
            comboFinishers: [
              {
                ownerId: 'necromancer',
                finisherType: 'Projectile',
                chance: 1,
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon'
      }
    ],
    handlerId: 'necromancer.minion-command'
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
  [ID.TASTE_OF_DEATH]: {
    implemented: true,
    castTimeMs: 1000,
    minionKey: 'blood-fiend',
    consumes: 1,
    effects: [],
    handlerId: 'necromancer.minion-command'
  },
  [ID.SPECTRAL_ARMOR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
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
  [ID.SUMMON_SHADOW_FIEND]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    rechargeOnMinionDeath: true,
    handlerId: 'necromancer.minion'
  },
  [ID.HAUNT]: {
    implemented: true,
    castTimeMs: 0,
    minionKey: 'shadow-fiend',
    impactDelay: 2,
    lifeForceOnHit: 10,
    effects: [
      { type: 'strike', coefficient: 0.4, hits: 1, actorType: 'summon' },
      { type: 'blind', actorType: 'summon', metadata: { duration: 5 } },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ],
    handlerId: 'necromancer.minion-command'
  },
  [ID.LIFE_TRANSFER]: {
    implemented: true,
    quicknessCastTimeMs: 2920,
    effects: [
      {
        type: 'strike',
        coefficient: 3.825,
        hits: 9,
        atMs: 222,
        intervalMs: 222,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 222,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 444,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 666,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 888,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 1110,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 1332,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 1554,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 1776,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        atMs: 1998,
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
  [ID.NECROTIC_GRASP]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ],
    lifeForceGain: 4,
    handlerId: 'necromancer.corruption'
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
  [ID.CHILLBLAINS]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 8
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
  [ID.WELL_OF_DARKNESS]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 4.800000000000001,
        hits: 6,
        comboFields: [{ ownerId: 'necromancer', fieldType: 'Dark', duration: 5 }],
        atMs: 280,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'blind',
        applications: 6,
        atMs: 280,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true,
        metadata: {
          duration: 3
        }
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        applications: 6,
        atMs: 280,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_POWER]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.SIGNET_OF_UNDEATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'custom',
        eventType: 'necromancer.revive',
        event: {}
      }
    ],
    lifeForceGain: 0
  },
  [ID.SIGNET_OF_THE_LOCUST]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SPECTRAL_GRASP]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 4
        }
      }
    ],
    lifeForceGain: 15
  },
  [ID.SIGNET_OF_SPITE]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          duration: 5
        }
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 5,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GRIM_SPECTER]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 520,
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
        coefficient: 0,
        hits: 1,
        atMs: 1750,
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
        coefficient: 0,
        hits: 1,
        atMs: 2750,
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
        coefficient: 0,
        hits: 1,
        atMs: 3750,
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
        coefficient: 0,
        hits: 1,
        atMs: 4750,
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
        coefficient: 0.33,
        hits: 1,
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon',
        packetLabel: 'attack',
        name: 'Unstable Horror - Attack'
      },
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 6000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'summon',
        packetLabel: 'explosion',
        name: 'Unstable Horror - Explosion'
      }
    ],
    handlerId: 'necromancer.summon-madness'
  },
  [ID.SUMMON_FLESH_GOLEM]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    rechargeOnMinionDeath: true,
    handlerId: 'necromancer.minion'
  },
  [ID.CHARGE]: {
    implemented: true,
    castTimeMs: 1000,
    minionKey: 'flesh-golem',
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1, actorType: 'summon' },
      {
        type: 'control',
        actorType: 'summon',
        metadata: { controlKind: 'knockdown' }
      }
    ],
    handlerId: 'necromancer.minion-command'
  },
  [ID.SPECTRAL_WALK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ],
    lifeForceGain: 4
  },
  [ID.SPECTRAL_RECALL]: {
    implemented: true,
    castTimeMs: 500,
    effects: []
  },
  [ID.CORROSIVE_POISON_CLOUD]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 2
      }
    ],
    handlerId: 'necromancer.corruption'
  },
  [ID.BLOOD_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.RENDING_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.UNHOLY_FEAST]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.NECROTIC_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 2
      }
    ]
  },
  [ID.NECROTIC_STAB]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 4
  },
  [ID.NECROTIC_BITE]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      }
    ],
    lifeForceGain: 8
  },
  [ID.DEATHLY_SWARM]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'blind',
        metadata: {
          duration: 6
        }
      }
    ],
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.ENFEEBLING_BLOOD]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    // The ground packet launches by 638 ms and must survive a weapon-swap cancel until its delayed impact.
    interruptCommitMs: 638,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6,
        atMs: 1200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.FEAST_OF_CORRUPTION]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4
      }
    ],
    lifeForceGain: 8,
    flipSkillId: null
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
  [ID.REAPERS_MARK]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'fear'
        }
      }
    ]
  },
  [ID.PUTRID_MARK]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1
      }
    ],
    handlerId: 'necromancer.condition-transfer'
  },
  [ID.MARK_OF_BLOOD]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      }
    ]
  },
  [ID.TAINTED_SHACKLES]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 12,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 12,
        atMs: 1250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 12,
        atMs: 2250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 12,
        atMs: 3250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 4250,
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
  [ID.SIGNET_OF_VAMPIRISM]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 6,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        flatStrikeBase: 163,
        flatStrikePowerCoeff: 0.05,
        actorType: 'effect',
        name: 'Signet of Vampirism - Vampiric Mark',
        metadata: { noCrit: true, damageKind: 'life-steal' }
      }
    ]
  },
  [ID.DUSK_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ],
    lifeForceGain: 2
  },
  [ID.GRASPING_DARKNESS]: {
    interruptCommitMs: 0,
    commitAtMs: 180,
    implemented: true,
    quicknessCastTimeMs: 520,
    lifeForceOnHit: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1,
        atMs: 1440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 4
        },
        atMs: 1440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        atMs: 1440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {
          controlKind: 'pull'
        }
      }
    ],
    handlerId: 'necromancer.grasping-darkness'
  },
  [ID.NIGHTFALL]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 480,
    lifeForcePerPulse: 7,
    effects: [
      {
        type: 'strike',
        coefficient: 4.6,
        hits: 4,
        comboFields: [{ ownerId: 'necromancer', fieldType: 'Dark', duration: 3 }],
        atMs: 400,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'blind',
        applications: 4,
        atMs: 400,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        applications: 4,
        atMs: 400,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ],
    handlerId: 'necromancer.nightfall'
  },
  [ID.CHILLING_SCYTHE]: {
    implemented: true,
    quicknessCastTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 2
        },
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5,
    handlerId: 'necromancer.chilling-scythe'
  },
  [ID.GRAVEDIGGER]: {
    implemented: true,
    quicknessCastTimeMs: 1080,
    // Completing Gravedigger resets its recharge once the target is below half health.
    mechanicTriggers: [
      {
        type: 'necromancer.core.reset-gravedigger-below-half',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 3.6,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 3,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FADING_TWILIGHT]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 2
  },
  [ID.DEATH_SPIRAL]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        name: 'Death Spiral — Life Siphon',
        metadata: {
          skillName: 'Death Spiral — Life Siphon',
          parentSkillName: 'Death Spiral',
          flatStrikeBase: 3517,
          flatStrikePowerCoeff: 0.01,
          noCrit: true,
          damageKind: 'life-steal'
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 12
      }
    ]
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
  [ID.OPPRESSIVE_COLLAPSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 9,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'control'
        }
      }
    ],
    handlerId: 'necromancer.oppressive-collapse'
  },
  [ID.MARCH_OF_UNDEATH]: {
    implemented: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.HARROWING_WAVE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5
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
  [ID.DEVOURING_DARKNESS]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [],
    lifeForceGain: 8,
    handlerId: 'necromancer.devouring-darkness',
    flipParentId: null
  },
  [ID.SOUL_GRASP]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 5
      }
    ],
    lifeForceGain: 11
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
  },
  [ID.VILE_BLAST]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 6,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'control'
        }
      }
    ],
    lifeForceGain: 4
  },
  [ID.WEEPING_SHOTS]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 240, coefficient: 0.4 },
          { atMs: 360, coefficient: 0.4 },
          { atMs: 520, coefficient: 0.4 },
          { atMs: 640, coefficient: 0.4 },
          { atMs: 760, coefficient: 0.4 },
          { atMs: 880, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 240, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 360, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 520, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 640, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 760, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 880, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 6
      }
    ],
    lifeForceGain: 9
  },
  [ID.VICIOUS_SHOT]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 600,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3.5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIFE_SIPHON]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 2.7,
        hits: 9,
        atMs: 480,
        intervalMs: 160,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ],
    handlerId: 'necromancer.life-siphon'
  },
  [ID.PATH_OF_GLUTTONY]: {
    implemented: true,
    quicknessCastTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.HUNGERING_MAELSTROM]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 640,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 5,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ENERVATION_ECHO]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEATHLY_ENERVATION]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 2
        }
      }
    ]
  },
  [ID.GORGE]: {
    implemented: true,
    quicknessCastTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.RAVENOUS_WAVE]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    flipDuration: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    lifeForceGain: 12
  },
  [ID.SATIATE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      }
    ]
  },
  [ID.CONSUME]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 480,
        intervalMs: 280,
        intervalTimingScale: 'fixed',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 8,
        stacks: 5,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ENERVATION_BLADE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEVOURING_VISAGE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'fear',
          duration: 1.5
        }
      }
    ],
    lifeForceGain: 10
  },
  [ID.GORMANDIZE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 5
        },
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.EXTIRPATE]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 3.8,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 3,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 8,
        stacks: 5,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'buff',
        kind: 'extirpation',
        duration: 4,
        stacks: 3,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 12,
    handlerId: 'necromancer.extirpate'
  },
  [ID.DARK_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ADDLE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.9,
        hits: 1,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 10,
    handlerId: 'necromancer.addle'
  },
  [ID.DEADLY_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    handlerId: 'necromancer.deadly-slice'
  },
  [ID.SINISTER_STAB]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 2
        },
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5,
    handlerId: 'necromancer.sinister-stab'
  },
  [ID.PERFORATE]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          },
          {
            atMs: 480,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 560,
            coefficient: 0.5
          },
          {
            atMs: 640,
            coefficient: 0.5
          },
          {
            atMs: 720,
            coefficient: 0.5
          },
          {
            atMs: 760,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.2
          }
        ]
      }
    ],
    handlerId: 'necromancer.perforate'
  },
  [ID.ISOLATE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        event: {
          duration: 3
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 8,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    flipDuration: 3,
    flipActivationAtMs: 660
  },
  [ID.DISTRESS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'necromancer.distress'
  }
});

export const NECROMANCER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap between weapon sets. The swap has a 10-second recharge.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    implemented: true,
    handlerId: 'necromancer.weapon-swap',
    effects: []
  }),
  Object.freeze({
    id: ID.EXIT_LICH_FORM,
    name: 'Exit Lich Form',
    description: 'Leave Lich Form and return to your normal skill bar.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 0,
    implemented: true,
    handlerId: 'necromancer.lich',
    flipParentId: ID.LICH_FORM,
    flipParent: 'Lich Form',
    effects: []
  })
]);
