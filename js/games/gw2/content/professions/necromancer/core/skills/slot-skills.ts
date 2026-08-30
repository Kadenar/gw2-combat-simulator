/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WELL_OF_BLOOD]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
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
  }
});
