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
        atMs: 0,
        name: 'Metal Legion Guitar — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.5 }],
        name: 'Final Smash',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 400 + index * 500,
          condition: 'Confusion',
          stacks: 1,
          duration: 8
        })),
        actorType: 'player',
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
        ticks: [{ atMs: 0, coefficient: 0.8 }],
        name: 'Metal Legion Guitar — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.5 }],
        name: 'Final Smash',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Confusion', stacks: 1, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
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
        ticks: [{ atMs: 0, coefficient: 2.4 }],
        name: 'Forged Surfer Dash — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 100, coefficient: 6 / 5 })),
        name: 'Additional Bomb Damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: index * 100,
          condition: 'Burning',
          stacks: 1,
          duration: 3.5
        })),
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: [{ atMs: 3000, coefficient: 2 }],
        name: 'Holo-Dancer Decoy',
        actorType: 'player',
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
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Exalted Hammer',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: Array.from({ length: 3 }, (_, index) => ({
          atMs: 111.333333333333 + index * 111.333333333333,
          coefficient: 3 / 3
        })),
        name: 'Stone Summit Cannon — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Stone Summit Cannon — Packet 2',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 3, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 3, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: [{ atMs: 0, coefficient: 1.2 }],
        name: 'Zephyrite Sun Crystal',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 2, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: [{ atMs: 0, coefficient: 1.2 }],
        name: 'Inquest Portal Device — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.2 }],
        name: 'Inquest Portal Device — Packet 2',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 3, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 3, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        atMs: 0,
        name: 'Chak Shield',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: [{ atMs: 0, coefficient: 1.6 }],
        name: 'Emergency Jade Shield',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: [{ atMs: 0, coefficient: 1.2 }],
        name: 'Zephyrite Sun Crystal',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Burning', stacks: 2, duration: 4 }],
        actorType: 'player',
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
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Unstable Skritt Bomb',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 760 + index * 400, coefficient: 2.8 / 8 })),
        name: 'Summon Kryptis Turret',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 8 }, (_, index) => ({
          atMs: 760 + index * 400,
          condition: 'Torment',
          stacks: 1,
          duration: 4
        })),
        actorType: 'player',
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
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Exalted Hammer',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 167 + index * 167, coefficient: 6 / 3 })),
        name: 'Holo-Dancer Decoy',
        actorType: 'player',
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
        ticks: [{ atMs: 0, coefficient: 3 }],
        name: 'Skritt Scuffle',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
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
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 500 + index * 1000, coefficient: 2.5 / 5 })),
        name: 'Mistburn Mortar',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 500 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 1.5
        })),
        actorType: 'player',
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
