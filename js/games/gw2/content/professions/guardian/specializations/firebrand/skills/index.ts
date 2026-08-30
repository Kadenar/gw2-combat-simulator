import { GUARDIAN_SKILL_IDS as ID } from '../../../data/ids.js';
import type { SkillFragment } from '../../../../../../platform/engine/types.js';

export const FIREBRAND_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SCORCHED_AFTERMATH]: {
    implemented: true,
    quicknessCastTimeMs: 920,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        ticks: [440, 1440, 2440, 3440, 4440].map((atMs) => ({
          atMs,
          coefficient: 0.64
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        atMs: 1440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        atMs: 2440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        atMs: 3440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        atMs: 4440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        atMs: 1440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        atMs: 2440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        atMs: 3440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        atMs: 4440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PORTENT_OF_FREEDOM]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 25,
    ammo: 3,
    ammoRecharge: 25,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        recipients: 'party'
      }
    ]
  },
  [ID.IGNITING_BURST]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RADIANT_RECOVERY]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.MANTRA_OF_POTENCE]: {
    implemented: true,
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.STALWART_STAND]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 1250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 2250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 3250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SEARING_SPELL]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 0.95,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2.5,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 10,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STOW_TOME]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.stow-tome',
    effects: []
  },
  [ID.RESTORING_REPRIEVE]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 2,
        recipients: 'party'
      }
    ]
  },
  [ID.MANTRA_OF_SOLACE]: {
    implemented: true,
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 24,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.TOME_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.VALIANT_BULWARK]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.DARING_CHALLENGE]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'taunt',
          duration: 2
        }
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 3
      }
    ]
  },
  [ID.OVERWHELMING_CELERITY]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 8,
        duration: 10,
        recipients: 'party'
      }
    ]
  },
  [ID.SHINING_RIVER]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 1250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 2250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 3250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 4250,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TOME_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.ECHO_OF_TRUTH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.TOME_OF_COURAGE_ID_42371]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.HEATED_REBUKE]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'pull'
        }
      }
    ]
  },
  [ID.OPENING_PASSAGE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.ASHES_OF_THE_JUST]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.ETERNAL_OASIS]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.POTENT_HASTE]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2.5,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 5,
        duration: 6,
        recipients: 'party'
      }
    ]
  },
  [ID.UNFLINCHING_CHARGE]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6
      }
    ]
  },
  [ID.MANTRA_OF_LIBERATION]: {
    implemented: true,
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 40,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.MANTRA_OF_TRUTH]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.CLARIFIED_CONCLUSION]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.TOME_OF_JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.UNBROKEN_LINES]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'buff',
        kind: 'toughness',
        duration: 5,
        stacks: 300
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 4
      }
    ]
  },
  [ID.DESERT_BLOOM]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.FLAME_RUSH]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-flame', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.AZURE_SUN]: {
    implemented: true,
    castTimeMs: 250,
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5
      }
    ]
  },
  [ID.MANTRA_OF_LORE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.MANTRA_OF_FLAME]: {
    implemented: true,
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.FLAME_SURGE]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-flame', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 12
      }
    ]
  },
  [ID.REJUVENATING_RESPITE]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 2,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 3,
        recipients: 'party'
      }
    ]
  },
  [ID.UNHINDERED_DELIVERY]: {
    implemented: true,
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 8,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'stability',
        stacks: 5,
        duration: 8,
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        recipients: 'party'
      }
    ]
  },
  [ID.TOME_OF_JUSTICE_ID_68647]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.TOME_OF_RESOLVE_ID_68648]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.TOME_OF_COURAGE_ID_68650]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  }
});
