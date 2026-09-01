/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EVISCERATE]: {
    implemented: true,
    cooldown: 8,
    castTimeMs: 0,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 5
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Eviscerate — Level 1 Damage'
      }
    ]
  },
  [ID.ARCING_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
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
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.EARTHSHAKER]: {
    implemented: true,
    skillWeapon: 'Hammer',
    cooldown: 8,
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 840, coefficient: 2.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'stun',
        duration: 1
      }
    ]
  },
  [ID.KILL_SHOT]: {
    implemented: true,
    skillWeapon: 'Rifle',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage'
      }
    ]
  },
  [ID.SKULL_CRACK]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.WHIRLING_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT]: {
    interruptCommitMs: 0,
    implemented: true,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    burstFieldDurations: [3, 6, 9],
    quicknessCastTimeMs: 520,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.combustive-shot',
    effects: []
  },
  [ID.FORCEFUL_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Forceful Shot — Level 1 Damage'
      }
    ]
  },
  [ID.BREACHING_STRIKE]: {
    implemented: true,
    interruptCommitMs: 758,
    skillWeapon: 'Dagger',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 842,
    unaffectedByQuickness: true,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 758, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 758,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          attemptedBoonRemovals: 2
        }
      }
    ]
  },
  [ID.PATH_TO_VICTORY]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71932]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71950]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73006]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73042]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      }
    ]
  },
  [ID.BLOODTHIRSTER]: {
    implemented: true,
    skillWeapon: 'Sword',
    quicknessCastTimeMs: 500,
    dualWieldCastTimeMs: 400,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 3, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
