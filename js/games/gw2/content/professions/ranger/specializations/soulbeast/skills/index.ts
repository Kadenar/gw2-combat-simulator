/** Explicit PvE skill mechanics owned by the Soulbeast Ranger module. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Entering and leaving Beastmode are two states of the same F5 palette tile.
const BEASTMODE_PALETTE_TILE = 'ranger-soulbeast-beastmode-toggle';

export const SOULBEAST_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NARCOTIC_SPORES]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 6,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 3
      }
    ]
  },
  [ID.SMOKE_ASSAULT]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.VULTURE_STANCE]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Opens the Vulture Stance proc window with stance-duration traits; see `soulbeast/skills/execution.ts`.
    handlerId: 'ranger.vulture-stance'
  },
  [ID.PRIMAL_CRY]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 9,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 833
  },
  [ID.BITE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
        hits: 1
      }
    ]
  },
  [ID.WORLDLY_IMPACT]: {
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1.89 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 680
  },
  [ID.RAIN_OF_SPIKES]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5
      }
    ]
  },
  [ID.MAUL_ID_41406]: {
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 1.11 },
          { atMs: 440, coefficient: 1.11 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 2, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 560
  },
  [ID.DEVOURER_RETREAT]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.KICK]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.94,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 6
      }
    ]
  },
  [ID.CHOMP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.TAIL_SWIPE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.DARK_WATER]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1
      }
    ]
  },
  [ID.WING_BUFFET]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ]
  },
  [ID.QUICKENING_SCREECH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.PROTECTION]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.CHARGING_BITE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.54,
        hits: 7,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 7,
        duration: 10
      }
    ]
  },
  [ID.WORLDLY_IMPACT_ID_42809]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.89,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.BRUTAL_CHARGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.64,
        hits: 1
      }
    ]
  },
  [ID.TAKEDOWN]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    // Custom: Enters Beastmode, disables the pet actor, and applies toggle traits; see `soulbeast/skills/execution.ts`.
    handlerId: 'ranger.beastmode-enter'
  },
  [ID.LEAVE_BEASTMODE]: {
    castTimeMs: 0,
    paletteTileId: BEASTMODE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    // Custom: Leaves Beastmode, restores the pet actor, and applies toggle traits; see `soulbeast/skills/execution.ts`.
    handlerId: 'ranger.beastmode-exit'
  },
  [ID.DEFY_PAIN]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.TAIL_LASH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.BITE_ID_43136]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.HEALING_CLOUD]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 6
      }
    ]
  },
  [ID.PRELUDE_LASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.01,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.FRENZIED_ATTACK]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10
      }
    ]
  },
  [ID.POISON_GAS]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.PHOTOSYNTHESIZE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.CRIPPLING_LEAP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.CALL_LIGHTNING_ID_43788]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      }
    ]
  },
  [ID.ENTANGLING_WEB]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.FEAR]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.CRIPPLING_ANGUISH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6
      }
    ]
  },
  [ID.MAUL_ID_44514]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 10
      }
    ]
  },
  [ID.HARMONIC_CRY]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.SPIRITUAL_REPRIEVE]: {
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.CHOMP_ID_44885]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.BEAR_STANCE]: {
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.SWOOP_ID_44991]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
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
  [ID.SHARPEN_SPINES]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.ONE_WOLF_PACK]: {
    effects: [],
    quicknessCastTimeMs: 360,
    // Custom: Opens the One Wolf Pack proc window with stance-duration traits; see `soulbeast/skills/execution.ts`.
    handlerId: 'ranger.one-wolf-pack'
  },
  [ID.CHARGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.565,
        hits: 1,
        name: 'Charge - Travel Damage'
      },
      {
        type: 'strike',
        coefficient: 1.13,
        hits: 1,
        name: 'Charge - Impact Damage'
      }
    ]
  },
  [ID.UNFLINCHING_FORTITUDE]: {
    effects: [],
    quicknessCastTimeMs: 167
  },
  [ID.TAIL_LASH_ID_46386]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.BRUTAL_CHARGE_ID_46432]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'knockdown'
      }
    ]
  },
  [ID.ETERNAL_BOND]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.DASH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.SLAM]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.UNDEAD_PLAGUE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.HEAVY_SHOT]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ]
  },
  [ID.PHASE_POUNCE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5
      }
    ]
  },
  [ID.LEY_LINE_VORTEX]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 8,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.LUNGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.ELECTROCUTE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      }
    ]
  },
  [ID.SPIT_GOOP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.TORMENTING_VISIONS]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 4,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 8,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 6
      }
    ]
  },
  [ID.STARING_VOID]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 6
      }
    ]
  },
  [ID.BATTLE_MAUL]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.BOP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.BUMBLE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.STINGING_SORROW]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 7
      }
    ]
  },
  [ID.LEAPING_LIZARD]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.SAURIAN_MIGHT]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8
      }
    ]
  },
  [ID.TAIL_WHIP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.JET]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
