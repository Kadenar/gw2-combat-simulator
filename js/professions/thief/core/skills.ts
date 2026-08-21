import { THIEF_SKILL_IDS as ID } from '../data/ids.js';
import type { SkillFragment } from '../../../platform/engine/types.js';
import type { ThiefSkill } from '../types.js';

export const THIEF_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.THROW_GUNK]: {
    implemented: true,
    handlerId: 'thief.stolen-skill',
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 10.8,
        hits: 6,
        name: 'Throw Gunk',
        actorType: 'player',
        atMs: 59.76,
        intervalMs: 59.76,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BONE_CRACK]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Bone Crack',
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
    ]
  },
  [ID.BRANCH_BASH]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Branch Bash',
        actorType: 'player'
      }
    ]
  },
  [ID.BRANCH_LEAP]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Branch Leap (stolen skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.DRINK_STOLEN_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.THROW_CHAIN]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Throw Chain (stolen skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.CLUB_SHOCK_WAVE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Club Shock Wave',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ]
  },
  [ID.THROW_CORAL_SHARD]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Throw Coral Shard',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 15,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_CRYSTAL_SHARD_STOLEN_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Throw Crystal Shard (stolen skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 15,
        actorType: 'player'
      }
    ]
  },
  [ID.CONSUME_PLASMA]: {
    implemented: true,
    handlerId: 'thief.stolen-skill',
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2.5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 2.5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.EAT_EGG]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.THROW_FEATHERS]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 6,
    initiativeCost: 0,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.THROW_GEAR_STOLEN_SKILL]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Throw Gear (stolen skill)',
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
    ]
  },
  [ID.ICE_SHARD_STAB]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Ice Shard Stab',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_LAVA_ROCK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Throw Lava Rock',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.MACE_HEAD_CRACK]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mace Head Crack',
        actorType: 'player'
      }
    ]
  },
  [ID.SHOOT_RIFLE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Shoot Rifle',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 400
        }
      }
    ]
  },
  [ID.THROW_ROCK_STOLEN_SKILL_KNOCKDOWN]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.573,
        hits: 1,
        name: 'Throw Rock (stolen skill knockdown)',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ]
  },
  [ID.RUSTY_SCRAP_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.573,
        hits: 1,
        name: 'Rusty Scrap Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_SCALE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Throw Scale',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.USE_SCEPTER]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Lightning Whip Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Flame Burst Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10,
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
    ]
  },
  [ID.HEALING_SEED]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SKULL_FEAR]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.USE_STAFF]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.203,
        hits: 1,
        name: 'Chain Lightning Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Fireball Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 1
        }
      }
    ]
  },
  [ID.TOOTH_STAB]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Tooth Stab',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.BLINDING_TUFT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.EXPLODING_VENOM_SACK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_VINE_STOLEN_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Throw Vine (stolen skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_ROCK_STOLEN_SKILL_DAZE]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Throw Rock (stolen skill daze)',
        actorType: 'player'
      },
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
  [ID.WHIRLING_AXE]: {
    implemented: true,
    handlerId: 'thief.stolen-skill',
    castTimeMs: 3250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Whirling Axe (stolen skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.WHIRLING_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Whirling Strike (stolen skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_NET]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.DOUBLE_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 160, coefficient: 0.4 },
          { atMs: 280, coefficient: 0.4 }
        ],
        name: 'Double Strike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BACKSTAB]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 320,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Front damage',
        actorType: 'player',
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Dagger',
    stealthAttack: true
  },
  [ID.DEATH_BLOSSOM]: {
    implemented: true,
    movementSkill: true,
    quicknessCastTimeMs: 1040,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.21 },
          { atMs: 640, coefficient: 0.21 },
          { atMs: 800, coefficient: 0.21 }
        ],
        name: 'Death Blossom',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 560, condition: 'Bleeding', stacks: 2, duration: 6 },
          { atMs: 640, condition: 'Bleeding', stacks: 2, duration: 6 },
          { atMs: 800, condition: 'Bleeding', stacks: 2, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Dagger'
  },
  [ID.LARCENOUS_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.17,
        hits: 1,
        name: 'Larcenous Strike',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
  },
  [ID.BOLA_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Bola Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      }
    ]
  },
  [ID.SLICE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Slice (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.SHADOW_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.315,
        hits: 1,
        name: 'Shadow Strike — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.3125,
        hits: 1,
        name: 'Shot Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 6,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  },
  [ID.UNLOAD]: {
    implemented: true,
    quicknessCastTimeMs: 1320,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 3.36,
        hits: 8,
        name: 'Unload',
        actorType: 'player',
        atMs: 96.666666666667,
        intervalMs: 96.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 8
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Pistol'
  },
  [ID.HEAD_SHOT]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Head Shot',
        actorType: 'player'
      }
    ]
  },
  [ID.STEAL]: {
    implemented: true,
    stealTraitSkill: true,
    movementSkill: true,
    handlerId: 'thief.steal',
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.INFILTRATORS_STRIKE]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: "Infiltrator's Strike",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.FLANKING_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Flanking Strike',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Dagger'
  },
  [ID.DANCING_DAGGER]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Dancing Dagger',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SCORPION_WIRE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 1,
    ammo: 2,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Scorpion Wire',
        actorType: 'player'
      }
    ]
  },
  [ID.WITHDRAW]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 18,
    initiativeCost: 0,
    effects: []
  },
  [ID.TRICK_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Trick Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.CHOKING_GAS]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 4,
        name: 'Choking Gas',
        actorType: 'player',
        atMs: 90,
        intervalMs: 90,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.INFILTRATORS_ARROW]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    implemented: true,
    handlerId: 'thief.prepare-thousand-needles',
    castTimeMs: 750,
    cooldown: 30,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    effects: []
  },
  [ID.HIDE_IN_SHADOWS]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.CALTROPS]: {
    implemented: true,
    castTimeMs: 1150,
    cooldown: 24,
    initiativeCost: 0,
    durationMultiplier: 3,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 10,
        applications: 10,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ROLL_FOR_INITIATIVE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SPIDER_VENOM]: {
    implemented: true,
    handlerId: 'thief.spider-venom',
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'spider-venom',
        duration: 24,
        stacks: 6,
        recipients: 'party'
      }
    ]
  },
  [ID.SHADOW_SHOT]: {
    implemented: true,
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Shadow Shot',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 5
        }
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: 'Pistol'
  },
  [ID.CLUSTER_BOMB]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Large Explosion',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_CLUSTER]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 4,
        name: 'Small Explosion',
        actorType: 'player',
        atMs: 170,
        intervalMs: 170,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.BLINDING_POWDER]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.ASSASSINS_SIGNET]: {
    implemented: true,
    handlerId: 'thief.assassins-signet',
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.SIGNET_OF_MALICE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 12,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKALE_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.PREPARE_PITFALL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SIGNET_OF_SHADOWS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.SIGNET_OF_AGILITY]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: []
  },
  [ID.INFILTRATORS_SIGNET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.HASTE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.SHADOW_ASSAULT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 7.199999999999999,
        hits: 3,
        name: 'Shadow Assault',
        actorType: 'player',
        atMs: 120.24,
        intervalMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FLANKING_DIVE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Flanking Dive — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.625,
        hits: 1,
        name: 'Damage When Flanking',
        actorType: 'player'
      }
    ]
  },
  [ID.TOW_LINE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Tow Line',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 600
        }
      }
    ]
  },
  [ID.PIERCING_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Piercing Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.DELUGE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Deluge',
        actorType: 'player'
      }
    ]
  },
  [ID.ESCAPE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Missile Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Escape — Packet 2',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.CRIPPLING_SHOT_THIEF_HARPOON_GUN_SKILL]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Crippling Shot (thief harpoon gun skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.INK_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Ink Shot',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.SMOKE_TRAIL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.THIEVES_GUILD]: {
    implemented: true,
    handlerId: 'thief.thieves-guild',
    castTimeMs: 1500,
    cooldown: 120,
    initiativeCost: 0,
    effects: [],
    summonAttack: {
      basePower: 1750,
      criticalChance: 0.2,
      criticalDamage: 1.5,
      duration: 24,
      fallbackAttacks: [
        {
          name: 'Basic Attack',
          coefficientPerHit: 1.2,
          hits: 1,
          initialDelay: 1,
          interval: 1
        }
      ],
      summons: [
        {
          name: 'Male Dual-Pistol Thief',
          displayName: 'Thief',
          weapon: 'Pistol',
          weaponStrengthProfileId: 'weapon.pistol',
          attacks: [
            {
              name: 'Black Powder',
              skillId: 3669,
              coefficientPerHit: 0.8,
              hits: 1,
              initialDelay: 1.44
            },
            {
              name: 'Unload',
              skillId: 3666,
              coefficientPerHit: 0.175,
              hits: 12,
              initialDelay: 3.56,
              interval: 5.8
            }
          ]
        },
        {
          name: 'Female Dual-Dagger Thief',
          displayName: 'Thief',
          weapon: 'Dagger',
          weaponStrengthProfileId: 'weapon.dagger',
          attacks: [
            {
              name: 'Scorpion Wire',
              skillId: 3665,
              coefficientPerHit: 1.5,
              hits: 1,
              initialDelay: 1.72,
              conditions: [
                {
                  condition: 'Poisoned',
                  stacks: 2,
                  duration: 10
                },
                {
                  condition: 'Weakness',
                  stacks: 1,
                  duration: 4
                }
              ]
            },
            {
              name: 'Twisting Fang I',
              skillId: 3661,
              coefficientPerHit: 0.6,
              hits: 2,
              initialDelay: 2.52,
              interval: 2.68
            },
            {
              name: 'Twisting Fang II',
              skillId: 3662,
              coefficientPerHit: 1.6,
              hits: 1,
              initialDelay: 3.08,
              interval: 2.68
            },
            {
              name: 'Twisting Fang III',
              skillId: 3663,
              coefficientPerHit: 2.5,
              hits: 1,
              initialDelay: 3.72,
              interval: 2.68
            }
          ]
        },
        {
          name: 'Sword Thief',
          displayName: 'Thief',
          variant: 'Core Thief',
          weapon: 'Sword',
          weaponStrengthProfileId: 'weapon.sword'
        }
      ]
    }
  },
  [ID.DISABLING_SHOT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Disabling Shot (thief short bow skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.VITAL_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.575,
        hits: 1,
        name: 'Vital Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.DAGGER_STORM]: {
    implemented: true,
    castTimeMs: 2750,
    cooldown: 60,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Dagger Storm',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 7,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.WILD_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 0,
    initiativeCost: 0,
    resourceGain: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Wild Strike',
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 3,
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SLASH]: {
    implemented: true,
    castTimeMs: 625,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Slash (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.DEVOURER_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 40,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.ICE_DRAKE_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 36,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.HEARTSEEKER]: {
    implemented: true,
    movementSkill: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Heartseeker',
        actorType: 'player',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.25,
            multiplier: 2.22
          },
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.6
          }
        ]
      }
    ]
  },
  [ID.LOTUS_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Lotus Strike',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 5,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.STEAL_ID_13109]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.TWISTING_FANGS]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.63,
        hits: 2,
        name: 'Twisting Fangs',
        actorType: 'player',
        atMs: 180,
        intervalMs: 180,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Dagger',
    requiredOffHand: false
  },
  [ID.REPEATER]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        name: 'Repeater (offhand empty)',
        actorType: 'player',
        atMs: 168,
        intervalMs: 168,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: false
  },
  [ID.STAB]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Stab (thief sword skill)',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: false
  },
  [ID.BLACK_POWDER]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 3,
        name: 'Black Powder',
        actorType: 'player',
        atMs: 120.24,
        intervalMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        actorType: 'player',
        applications: 3,
        atMs: 0,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TACTICAL_STRIKE]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 525,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Tactical Strike',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Sword',
    stealthAttack: true
  },
  [ID.SNEAK_ATTACK]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 1000,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 5,
        name: 'Sneak Attack',
        actorType: 'player',
        atMs: 136,
        intervalMs: 136,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    stealthAttack: true
  },
  [ID.CRIPPLING_STRIKE]: {
    implemented: true,
    castTimeMs: 775,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1,
        name: 'Crippling Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.STAB_THIEF_SPEAR_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Stab (thief spear skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.JAB_THIEF_SKILL]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.15,
        hits: 1,
        name: 'Jab (thief skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.POISON_TIP_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Poison Tip Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.NINE_TAILED_STRIKE]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 16,
        hits: 8,
        name: 'Nine-Tailed Strike — Packet 1',
        actorType: 'player',
        atMs: 125.333333333333,
        intervalMs: 125.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Final Strike Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 9,
        actorType: 'player'
      }
    ]
  },
  [ID.INFILTRATORS_RETURN]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: []
  },
  [ID.SURPRISE_SHOT]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 250,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Surprise Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Shortbow',
    stealthAttack: true
  },
  [ID.BREAK_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 2,
    effects: []
  },
  [ID.BASILISK_VENOM]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 40,
    initiativeCost: 0,
    effects: []
  },
  [ID.LESSER_CALTROPS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.CLOAK_AND_DAGGER]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Cloak and Dagger',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.THROW_GUNK_ID_16460]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 10.8,
        hits: 6,
        name: 'Throw Gunk',
        actorType: 'player',
        atMs: 59.76,
        intervalMs: 59.76,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ICE_WURM_VENOM_TRAP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKELK_VENOM]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.WEAKENING_WHIRL]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 3,
        name: 'Weakening Whirl',
        actorType: 'player',
        atMs: 111.333333333333,
        intervalMs: 111.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.STAFF_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Staff Bash',
        actorType: 'player'
      }
    ]
  },
  [ID.HOOK_STRIKE]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 640,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Hook Strike',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 4
        }
      }
    ],
    requiredMainHand: 'Staff',
    stealthAttack: true
  },
  [ID.LESSER_HASTE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 60,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.PUNISHING_STRIKES]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 760,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.1,
        hits: 4,
        name: 'Punishing Strikes',
        actorType: 'player',
        atMs: 166.666666666667,
        intervalMs: 166.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.DEBILITATING_ARC]: {
    implemented: true,
    quicknessCastTimeMs: 200,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Debilitating Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.VAULT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Vault',
        actorType: 'player'
      }
    ]
  },
  [ID.STAFF_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Staff Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.DUST_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 3,
        name: 'Dust Strike',
        actorType: 'player',
        atMs: 173.333333333333,
        intervalMs: 173.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 1
        }
      }
    ]
  },
  [ID.ESSENCE_SAP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Essence Sap (stolen skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.DEATHS_ADVANCE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.KNEEL]: {
    implemented: true,
    handlerId: 'thief.kneel',
    castTimeMs: 500,
    cooldown: 0.5,
    initiativeCost: 1,
    effects: []
  },
  [ID.DEADLY_AIM]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Deadly Aim',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    kneelSkill: true
  },
  [ID.FREE_ACTION]: {
    implemented: true,
    handlerId: 'thief.free-action',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.BRUTAL_AIM]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Brutal Aim',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SKIRMISHERS_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: "Skirmisher's Shot",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.DEATHS_RETREAT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: "Death's Retreat",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.TRAIL_OF_KNIVES_DOPPELGANGER]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Trail of Knives (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.SOHOTHIN_BLOSSOM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 5,
    initiativeCost: 0,
    effects: []
  },
  [ID.DOUBLE_TAP]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 2,
        name: 'Double Tap',
        actorType: 'player',
        atMs: 260,
        intervalMs: 260,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ]
  },
  [ID.SPOTTERS_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1,
        name: "Spotter's Shot",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  },
  [ID.THREE_ROUND_BURST]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 3,
        name: 'Three Round Burst',
        actorType: 'player',
        atMs: 222,
        intervalMs: 222,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 3
      }
    ],
    kneelSkill: true
  },
  [ID.THROW_GUNK_ID_45094]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 10.8,
        hits: 6,
        name: 'Throw Gunk',
        actorType: 'player',
        atMs: 83,
        intervalMs: 83,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIFT_PIN]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.SOUL_STONE_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        name: 'Damage per Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_PLASMA]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        name: 'Detonate Plasma',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Vigor',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 10,
        stacks: 10
      },
      {
        type: 'boon',
        boon: 'Fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Aegis',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Stability',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Resistance',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.THROW_MAGNETIC_BOMB]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 6.300000000000001,
        hits: 3,
        name: 'Throw Magnetic Bomb',
        actorType: 'player',
        atMs: 173.333333333333,
        intervalMs: 173.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 360
        }
      }
    ]
  },
  [ID.UNSTABLE_ARTIFACT]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Unstable Artifact',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.HOOKED_SPEAR]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Hooked Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.BURST_OF_SHADOWS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Burst of Shadows',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.PITFALL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 3,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Initial Impact Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Pulse Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
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
    ]
  },
  [ID.THOUSAND_NEEDLES]: {
    implemented: true,
    handlerId: 'thief.thousand-needles',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 0,
        name: 'Thousand Needles — Initial Strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 1000, coefficient: 0.2 },
          { atMs: 2000, coefficient: 0.2 },
          { atMs: 3000, coefficient: 0.2 },
          { atMs: 4000, coefficient: 0.2 }
        ],
        name: 'Thousand Needles — Pulse',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 8,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.THROW_ENCHANTED_ICE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Throw Enchanted Ice',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 8,
        stacks: 2
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 360
        }
      }
    ]
  },
  [ID.THROW_UNSTABLE_REAGENT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Throw Unstable Reagent',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 360
        }
      }
    ]
  },
  [ID.BLESSING_SEED]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.DRINK_AMBROSIA]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 25
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.TIME_IN_A_BOTTLE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.THROW_CURSED_ARTIFACT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 10,
        hits: 5,
        name: 'Throw Cursed Artifact',
        actorType: 'player',
        atMs: 72,
        intervalMs: 72,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.REPEATER_ID_59526]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 7.5,
        hits: 5,
        name: 'Repeater',
        actorType: 'player',
        atMs: 168,
        intervalMs: 168,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  },
  [ID.SHADOW_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Shadow Bolt',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.ENDLESS_NIGHT]: {
    implemented: true,
    quicknessCastTimeMs: 1920,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2.31,
        hits: 7,
        name: 'Endless Night',
        actorType: 'player',
        atMs: 274.285714285714,
        intervalMs: 274.285714285714,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        atMs: 274.285714285714,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 274.285714285714,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 548.571428571429,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 822.857142857143,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1097.142857142857,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1371.428571428571,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          {
            atMs: 1645.714285714285,
            condition: 'Torment',
            stacks: 1,
            duration: 6
          },
          { atMs: 1920, condition: 'Torment', stacks: 1, duration: 6 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.TRIPLE_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 1080,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Triple Bolt',
        actorType: 'player',
        atMs: 1040,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 320, condition: 'Torment', stacks: 1, duration: 5 },
          { atMs: 640, condition: 'Torment', stacks: 1, duration: 5 },
          { atMs: 1040, condition: 'Torment', stacks: 1, duration: 5 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TRIPLE_THREAT]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1.35,
        hits: 3,
        name: 'Triple Threat',
        actorType: 'player',
        atMs: 333.333333333333,
        intervalMs: 333.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 333.333333333333, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 666.666666666667, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 1000, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: false
  },
  [ID.DOUBLE_BOLT]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Double Bolt',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Double Bolt',
        actorType: 'player',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 320, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TWILIGHT_COMBO]: {
    implemented: true,
    quicknessCastTimeMs: 760,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Initial Attack',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Secondary Attack',
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 5,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Dagger'
  },
  [ID.MEASURED_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Measured Shot',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    movementSkill: true,
    shadowstepSkill: true,
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.SHADOWSQUALL]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    quicknessCastTimeMs: 1960,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 8,
        name: 'Shadowsquall',
        actorType: 'player',
        atMs: 245,
        intervalMs: 245,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 245, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 490, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 735, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 980, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1225, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1470, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1715, condition: 'Poisoned', stacks: 1, duration: 3 },
          { atMs: 1960, condition: 'Poisoned', stacks: 1, duration: 3 }
        ],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    stealthAttack: true
  },
  [ID.SHADOW_SAP]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Shadow Sap',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.SNIPERS_COVER]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 4,
    effects: [],
    kneelSkill: true
  },
  [ID.DEATHS_JUDGMENT]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 500,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.67,
        hits: 1,
        name: "Death's Judgment — Packet 1",
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1,
        name: 'Damage on Unmarked Foes',
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Rifle',
    stealthAttack: true
  },
  [ID.HELMET_BREAKER]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Helmet Breaker',
        actorType: 'player'
      },
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
  [ID.VENOMOUS_VOLLEY]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 3.5999999999999996,
        hits: 3,
        name: 'Venomous Volley',
        actorType: 'player',
        atMs: 173.333333333333,
        intervalMs: 173.333333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.SPINNING_AXE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.HARROWING_STORM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Dagger'
  },
  [ID.RECALL_AXES]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: false
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Pistol'
  },
  [ID.SPINNING_AXE_ID_71967]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Spinning Axe',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.CUNNING_SALVO]: {
    implemented: true,
    handlerId: 'thief.stealth-attack',
    castTimeMs: 500,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Cunning Salvo',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Axe',
    stealthAttack: true
  },
  [ID.ENTANGLING_ASP]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 650,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Entangling Asp',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.SHATTERING_ASSAULT]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 800,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Shattering Assault',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISTRACTING_THROW]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 450,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Distracting Throw',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1.5
        }
      }
    ]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Unsuspecting Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SHADOW_VEIL]: {
    implemented: true,
    castTimeMs: 2000,
    cooldown: 0,
    initiativeCost: 3,
    effects: []
  },
  [ID.ASHEN_ASSAULT]: {
    implemented: true,
    preservesStealth: true,
    spearStealthAttack: true,
    handlerId: 'thief.spear-stealth-attack',
    castTimeMs: 575,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        name: 'Ashen Assault',
        actorType: 'player',
        atMs: 173.913043478261,
        intervalMs: 173.913043478261,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Ashen Assault — Final Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Spear',
    stealthAttack: true
  },
  [ID.MANTIS_STING]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mantis Sting',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.VAMPIRIC_SLASH]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Vampiric Slash — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Vampiric Slash — Life Siphon',
        actorType: 'player',
        canCrit: false
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.FALLING_SPIDER]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Falling Spider',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.BARBED_SPEAR]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Barbed Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2.25,
        actorType: 'player'
      }
    ]
  },
  [ID.LIFT_PIN_HERO_CHALLENGE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: []
  },
  [ID.FLAWLESS_EXECUTION]: {
    implemented: true,
    interruptMode: 'per-packet',
    castTimeMs: 2100,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400.3, coefficient: 0.53 },
          { atMs: 559.7, coefficient: 0.53 },
          { atMs: 718.9, coefficient: 0.53 }
        ],
        name: 'Flawless Execution — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Final Slash Damage',
        actorType: 'player',
        atMs: 1240.4,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 320.4, coefficient: 0.25 },
          { atMs: 439.7, coefficient: 0.25 },
          { atMs: 519.2, coefficient: 0.25 },
          { atMs: 640.2, coefficient: 0.25 },
          { atMs: 760.1, coefficient: 0.25 },
          { atMs: 840.5, coefficient: 0.25 }
        ],
        name: 'Projectile Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Sword',
    requiredOffHand: 'Pistol'
  },
  [ID.DEATHS_ADVANCE_ID_80278]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    kneelSkill: true
  }
});

export const THIEF_CORE_EXTRA_SKILLS: readonly ThiefSkill[] = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    handlerId: 'thief.weapon-swap',
    name: 'Swap Weapons',
    description: 'Swap equipped weapon sets.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    cooldown: 10,
    rechargeAnchor: 'castStart',
    implemented: true,
    effects: []
  }),
  Object.freeze({
    id: ID.DODGE,
    handlerId: 'thief.dodge',
    name: 'Dodge',
    description: 'Perform the selected thief dodge.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    implemented: true,
    effects: []
  })
]);
