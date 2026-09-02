import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const FIREBRAND_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SCORCHED_AFTERMATH]: {
    quicknessCastTimeMs: 920,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
        ticks: [{ atMs: 440, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1440, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2440, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3440, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 4440, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Bleeding', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1440, condition: 'Bleeding', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2440, condition: 'Bleeding', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3440, condition: 'Bleeding', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 4440, condition: 'Bleeding', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PORTENT_OF_FREEDOM]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 25,
    ammo: 3,
    ammoRecharge: 25,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'stability', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 5, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.IGNITING_BURST]: {
    quicknessCastTimeMs: 480,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.55 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Burning', stacks: 1, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Weakness', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RADIANT_RECOVERY]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.MANTRA_OF_POTENCE]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.STALWART_STAND]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
    quicknessCastTimeMs: 680,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.95 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Burning', stacks: 1, duration: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Vulnerability', stacks: 2, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STOW_TOME]: {
    castTimeMs: 0,
    // Custom: Closes the active tome and updates tome state; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.stow-tome',
    effects: []
  },
  [ID.RESTORING_REPRIEVE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'protection', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 2, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.MANTRA_OF_SOLACE]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 24,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.TOME_OF_RESOLVE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.VALIANT_BULWARK]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.DARING_CHALLENGE]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'taunt',
        duration: 2
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 3
      }
    ]
  },
  [ID.OVERWHELMING_CELERITY]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 8, duration: 10, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.SHINING_RIVER]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.ECHO_OF_TRUTH]: {
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
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.HEATED_REBUKE]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  },
  [ID.OPENING_PASSAGE]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.ASHES_OF_THE_JUST]: {
    quicknessCastTimeMs: 880,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.ETERNAL_OASIS]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.POTENT_HASTE]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    cooldown: 10,
    ammo: 3,
    ammoRecharge: 10,
    ammoCastLockout: 0,
    lockouts: [{ group: 'firebrand-mantra-potence', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'quickness', duration: 2.5, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'might', stacks: 5, duration: 6, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.UNFLINCHING_CHARGE]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 40,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.MANTRA_OF_TRUTH]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.CLARIFIED_CONCLUSION]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.TOME_OF_JUSTICE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.UNBROKEN_LINES]: {
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.FLAME_RUSH]: {
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
    castTimeMs: 250,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
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
    castTimeMs: 250,
    effects: []
  },
  [ID.MANTRA_OF_FLAME]: {
    castTimeMs: 2240,
    canCastConcurrently: false,
    cooldown: 20,
    ammo: 0,
    ammoRecharge: 0,
    effects: []
  },
  [ID.FLAME_SURGE]: {
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
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-solace', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'aegis', duration: 2, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'protection', duration: 3, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'resolution', duration: 3, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.UNHINDERED_DELIVERY]: {
    castTimeMs: 0,
    canCastConcurrently: true,
    lockouts: [{ group: 'firebrand-mantra-liberation', durationMs: 1000 }],
    tags: ['specialization-managed-flip'],
    effects: [
      { type: 'boon', boon: 'resolution', duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'stability', stacks: 5, duration: 8, audience: { recipients: 'party' as const } },
      { type: 'boon', boon: 'swiftness', duration: 5, audience: { recipients: 'party' as const } }
    ]
  }
});
