import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const ANTIQUARY_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.METAL_LEGION_GUITAR]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 2875,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3.2,
        hits: 4,
        name: 'Metal Legion Guitar — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Final Smash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 1,
        duration: 8,
        actorType: 'player',
        applications: 4,
        atMs: 400,
        intervalMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ],
    artifactKind: 'offensive'
  },
  [ID.METAL_LEGION_GUITAR_ID_76591]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 2000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Metal Legion Guitar — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Final Smash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ],
    artifactKind: 'offensive'
  },
  [ID.FORGED_SURFER_DASH_ID_76633]: {
    implemented: true,
    movementSkill: true,
    handlerId: 'thief.forged-surfer',
    castTimeMs: 300,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        name: 'Forged Surfer Dash — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 6,
        hits: 5,
        name: 'Additional Bomb Damage',
        actorType: 'player',
        intervalMs: 100,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3.5,
        actorType: 'player',
        applications: 5,
        intervalMs: 100,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    artifactKind: 'offensive'
  },
  [ID.HOLO_DANCER_DECOY]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 850,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'taunt',
          duration: 3
        }
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Holo-Dancer Decoy',
        actorType: 'player',
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 4,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1,
        atMs: 3000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.EXALTED_HAMMER_ID_76702]: {
    implemented: true,
    movementSkill: true,
    handlerId: 'thief.artifact',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Exalted Hammer',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.STONE_SUMMIT_CANNON]: {
    implemented: true,
    handlerId: 'thief.double-edge',
    usableWhileRecharging: true,
    castTimeMs: 780,
    cooldown: 15,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 3,
        name: 'Stone Summit Cannon — Packet 1',
        actorType: 'player',
        atMs: 111.333333333333,
        intervalMs: 111.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Stone Summit Cannon — Packet 2',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      }
    ],
    doubleEdge: true
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733]: {
    implemented: true,
    movementSkill: true,
    handlerId: 'thief.artifact',
    castTimeMs: 1000,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Zephyrite Sun Crystal',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 4,
        actorType: 'player'
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.CANACH_COIN_TOSS]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.EMERGENCY_JADE_SHIELD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.INQUEST_PORTAL_DEVICE]: {
    implemented: true,
    handlerId: 'thief.double-edge',
    usableWhileRecharging: true,
    castTimeMs: 500,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Inquest Portal Device — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Inquest Portal Device — Packet 2',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ],
    doubleEdge: true
  },
  [ID.CHAK_SHIELD]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        name: 'Chak Shield',
        actorType: 'player'
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.EMERGENCY_JADE_SHIELD_ID_76879]: {
    implemented: true,
    handlerId: 'thief.double-edge',
    usableWhileRecharging: true,
    castTimeMs: 0,
    cooldown: 15,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Emergency Jade Shield',
        actorType: 'player'
      }
    ],
    doubleEdge: true
  },
  [ID.ANTIVENOM_DRAUGHT_BACKFIRED]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 10,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    implemented: true,
    handlerId: 'thief.double-edge',
    usableWhileRecharging: true,
    castTimeMs: 750,
    cooldown: 10,
    initiativeCost: 0,
    effects: [],
    doubleEdge: true
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    implemented: true,
    movementSkill: true,
    handlerId: 'thief.artifact',
    castTimeMs: 330,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Zephyrite Sun Crystal',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 4,
        actorType: 'player',
        atMs: 400,
        intervalMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 5
        }
      }
    ],
    artifactKind: 'defensive'
  },
  [ID.UNSTABLE_SKRITT_BOMB]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Unstable Skritt Bomb',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockback',
          duration: 180
        }
      }
    ],
    backfire: true
  },
  [ID.RESHUFFLE]: {
    implemented: true,
    handlerId: 'thief.reshuffle',
    castTimeMs: 0,
    cooldown: 5,
    initiativeCost: 2,
    effects: []
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.SUMMON_KRYPTIS_TURRET_ID_77192]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 660,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 8,
        name: 'Summon Kryptis Turret',
        actorType: 'player',
        atMs: 760,
        intervalMs: 400,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        applications: 8,
        atMs: 760,
        intervalMs: 400,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    artifactKind: 'offensive'
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: []
  },
  [ID.FORGED_SURFER_DASH]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.EXALTED_HAMMER]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Exalted Hammer',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HOLO_DANCER_DECOY_ID_76800]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 6,
        hits: 3,
        name: 'Holo-Dancer Decoy',
        actorType: 'player',
        atMs: 167,
        intervalMs: 167,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 4
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.MISTBURN_MORTAR_ID_77288]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.CANACH_COIN_TOSS_ID_77230]: {
    implemented: true,
    handlerId: 'thief.double-edge',
    usableWhileRecharging: true,
    castTimeMs: 0,
    cooldown: 15,
    initiativeCost: 0,
    effects: [],
    doubleEdge: true
  },
  [ID.SKRITT_SCUFFLE]: {
    implemented: true,
    handlerId: 'thief.skritt-scuffle',
    castTimeMs: 840,
    cooldown: 50,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Skritt Scuffle',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 0
        }
      }
    ],
    doubleEdge: true
  },
  [ID.MISTBURN_MORTAR]: {
    implemented: true,
    handlerId: 'thief.artifact',
    castTimeMs: 950,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        name: 'Mistburn Mortar',
        actorType: 'player',
        atMs: 500,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        applications: 5,
        atMs: 500,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    artifactKind: 'offensive'
  },
  [ID.INQUEST_PORTAL_DEVICE_BACKFIRED]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [],
    backfire: true
  },
  [ID.SKRITT_SWIPE]: {
    implemented: true,
    stealTraitSkill: true,
    movementSkill: true,
    handlerId: 'thief.skritt-swipe',
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  }
});
