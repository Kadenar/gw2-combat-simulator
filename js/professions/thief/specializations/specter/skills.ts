import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

export const SPECTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SIPHON]: {
    implemented: true,
    handlerId: 'thief.siphon',
    quicknessCastTimeMs: 520,
    cooldown: 18,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ENTER_SHADOW_SHROUD]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-enter',
    castTimeMs: 0,
    cooldown: 8,
    initiativeCost: 0,
    effects: []
  },
  [ID.ETERNAL_NIGHT]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 740,
    cooldown: 8,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 2,
        name: 'Eternal Night',
        actorType: 'player',
        atMs: 540,
        intervalMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player',
        atMs: 540,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        atMs: 1020,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 540, condition: 'Poisoned', stacks: 2, duration: 4 },
          { atMs: 1020, condition: 'Poisoned', stacks: 2, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.GRASPING_SHADOWS]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 240,
    cooldown: 3,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.66,
        hits: 1,
        name: 'Grasping Shadows',
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6,
        actorType: 'player',
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.DAWNS_REPOSE]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 520,
    cooldown: 8,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: "Dawn's Repose",
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'fear',
          duration: 1
        }
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.WELL_OF_SILENCE]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ]
  },
  [ID.MIND_SHOCK]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 360,
    cooldown: 16,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Mind Shock',
        actorType: 'player',
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 4,
        stacks: 3
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun'
        }
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    shadowShroudSkill: true
  },
  [ID.EXIT_SHADOW_SHROUD]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-exit',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.SHADOWFALL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 75,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 3,
        name: 'Shadowfall',
        actorType: 'player',
        atMs: 167,
        intervalMs: 167,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 1
        }
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 50
        }
      }
    ]
  },
  [ID.WELL_OF_SORROW]: {
    interruptCommitMs: 0,
    implemented: true,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.11,
        hits: 5,
        name: 'Well of Sorrow',
        actorType: 'player',
        atMs: 400,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Torment', stacks: 2, duration: 6 },
          { atMs: 1400, condition: 'Bleeding', stacks: 3, duration: 6 },
          { atMs: 2400, condition: 'Torment', stacks: 2, duration: 6 },
          { atMs: 3400, condition: 'Poisoned', stacks: 3, duration: 6 },
          { atMs: 4400, condition: 'Torment', stacks: 2, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_GLOOM]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 1000,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.WELL_OF_TEARS]: {
    interruptCommitMs: 0,
    implemented: true,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 5,
        hits: 5,
        name: 'Well of Tears',
        actorType: 'player',
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.WELL_OF_BOUNTY]: {
    interruptCommitMs: 0,
    implemented: true,
    movementSkill: true,
    shadowstepSkill: true,
    quicknessCastTimeMs: 400,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 2,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 15,
        stacks: 8,
        atMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        atMs: 2000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 8,
        stacks: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 12,
        stacks: 1,
        atMs: 4000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.HAUNT_SHOT]: {
    implemented: true,
    handlerId: 'thief.shadow-shroud-skill',
    quicknessCastTimeMs: 640,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.075,
        hits: 1,
        name: 'Haunt Shot',
        actorType: 'player',
        atMs: 850,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player',
        atMs: 850,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ],
    shadowShroudSkill: true
  }
});
