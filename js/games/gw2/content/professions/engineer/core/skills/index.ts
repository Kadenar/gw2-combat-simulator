/**
 * Core Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { Skill, SkillFragment } from '../../../../../platform/engine/types.js';
import { ENGINEER_MED_KIT_SKILL_MECHANICS } from './kits/med-kit.js';
import { ENGINEER_GRENADE_KIT_SKILL_MECHANICS } from './kits/grenade-kit.js';
import { ENGINEER_BOMB_KIT_SKILL_MECHANICS } from './kits/bomb-kit.js';
import { ENGINEER_TOOL_KIT_SKILL_MECHANICS } from './kits/tool-kit.js';
import { ENGINEER_FLAMETHROWER_SKILL_MECHANICS } from './kits/flamethrower.js';
import { ENGINEER_ELIXIR_GUN_SKILL_MECHANICS } from './kits/elixir-gun.js';
import {
  ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS,
  ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS
} from './kits/elite-mortar-kit.js';

export { ENGINEER_TURRET_ATTACK_SKILLS } from '../mechanics/turrets.js';

// Composes kit fragments with physical weapons, utilities, toolbelt actions, and synthetic Core skills.
export const ENGINEER_CORE_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  ...ENGINEER_MED_KIT_SKILL_MECHANICS,
  ...ENGINEER_GRENADE_KIT_SKILL_MECHANICS,
  ...ENGINEER_BOMB_KIT_SKILL_MECHANICS,
  ...ENGINEER_TOOL_KIT_SKILL_MECHANICS,
  ...ENGINEER_FLAMETHROWER_SKILL_MECHANICS,
  ...ENGINEER_ELIXIR_GUN_SKILL_MECHANICS,
  ...ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS,
  [ID.PERSONAL_BATTERING_RAM]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 5,
    ammo: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Personal Battering Ram',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 450
        }
      }
    ]
  },
  [ID.JUMP_SHOT_ID_5817]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Leap Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        name: 'Landing Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 7,
        actorType: 'player'
      }
    ]
  },
  [ID.RIFLE_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_RIFLE_TURRET,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3.75,
        hits: 5,
        atMs: 500,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Turret',
        actorType: 'summon',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ELIXIR_B]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
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
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 10,
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
  [ID.SLICK_SHOES]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    effects: [
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
  [ID.FRAGMENTATION_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 0,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Fragmentation Shot',
        interruptCommitMs: 360,
        persistsAfterInterrupt: true,
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        interruptCommitMs: 360,
        persistsAfterInterrupt: true,
        actorType: 'player'
      }
    ]
  },
  [ID.POISON_DART_VOLLEY]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 8,
    // Poison Dart Volley is a channel: interruption retains landed darts and cancels only its future packets.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 5,
        atMs: 168,
        intervalMs: 168,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Poison Dart Volley',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 168, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 336, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 504, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 672, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 840, condition: 'Poisoned', stacks: 1, duration: 7 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      }
    ]
  },
  [ID.STATIC_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Static Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.GLUE_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 20,
    duration: 5,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Glue Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 1000, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 2000, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 3000, condition: 'Crippled', stacks: 1, duration: 2 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
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
  [ID.BLOWTORCH]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    interruptCommitMs: 360,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 4.5,
        actorType: 'player'
      }
    ]
  },
  [ID.ELIXIR_X]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 75,
    effects: []
  },
  [ID.ELIXIR_H]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.FLAME_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_FLAME_TURRET,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 5,
        atMs: 500,
        intervalMs: 3000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Flame Turret',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'summon'
      }
    ]
  },
  [ID.NET_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_NET_TURRET,
    castTimeMs: 500,
    cooldown: 30,
    effects: []
  },
  [ID.THUMPER_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_THUMPER_TURRET,
    castTimeMs: 500,
    cooldown: 40,
    effects: [
      {
        type: 'strike',
        coefficient: 5,
        hits: 5,
        atMs: 500,
        intervalMs: 3000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Thumper Turret',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'summon'
      }
    ]
  },
  [ID.HEALING_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_HEALING_TURRET,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ELIXIR_C]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: []
  },
  [ID.ELIXIR_S]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    effects: []
  },
  [ID.ELIXIR_U]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.UTILITY_GOGGLES]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.TOSS_ELIXIR_R]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 90,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.SUPPLY_CRATE]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 75,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Supply Crate',
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.AUTOMATIC_FIRE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Automatic Fire',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.THUMP]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Thump',
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
    ]
  },
  [ID.ELECTRIFIED_NET]: {
    implemented: true,
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Electrified Net',
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
  [ID.SMOKE_SCREEN]: {
    implemented: true,
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_BOOTS]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 2,
    ammo: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Rocket Boots',
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_TURRET]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE_ROCKET_TURRET,
    castTimeMs: 500,
    cooldown: 40,
    effects: [
      {
        type: 'strike',
        coefficient: 11.25,
        hits: 5,
        atMs: 500,
        intervalMs: 4000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rocket Turret',
        actorType: 'summon',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.EXPLOSIVE_ROCKETS]: {
    implemented: true,
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        name: 'Explosive Rockets',
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
  [ID.DETONATE_RIFLE_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Rifle Turret',
    castTimeMs: 0,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Rifle Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_THUMPER_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Thumper Turret',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Thumper Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_HEALING_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Healing Turret',
    castTimeMs: 0,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Healing Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.TOSS_ELIXIR_B]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'Stability',
        duration: 4,
        stacks: 3
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
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir B'
  },
  [ID.ELIXIR_R]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    effects: []
  },
  [ID.TOSS_ELIXIR_C]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 16,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.TOSS_ELIXIR_U]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_S]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.SUPERSPEED_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [],
    toolbeltParentName: 'Slick Shoes'
  },
  [ID.TOSS_ELIXIR_H]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 4,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir H',
    mechanicSlot: 1
  },
  [ID.CLEANSING_BURST]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.LAUNCH_PERSONAL_BATTERING_RAM]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Launch Personal Battering Ram',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Personal Battering Ram'
  },
  [ID.ROCKET_KICK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Kick',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rocket Boots'
  },
  [ID.DETONATE_NET_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Net Turret',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Net Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_FLAME_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Flame Turret',
    castTimeMs: 0,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Flame Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.RIFLE_BURST]: {
    implemented: true,
    // Rifle Burst is a channel: interruption retains landed packets and cancels only its future packet.
    quicknessCastTimeMs: 640,
    cooldown: 0,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            chance: 0.2,
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          projectile: true
        }
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rifle Burst Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ]
  },
  [ID.NET_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 570,
    cooldown: 9,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Net Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 4,
        atMs: 518,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.JUMP_SHOT]: {
    implemented: true,
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        atMs: 117,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Leap Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Landing Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 7,
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.LESSER_GRENADE_BARRAGE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 6,
        name: 'Lesser Grenade Barrage',
        actorType: 'player'
      }
    ]
  },
  [ID.MAGNETIC_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    castTimeMs: 3000,
    cooldown: 20,
    effects: []
  },
  [ID.STATIC_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    castTimeMs: 2500,
    cooldown: 24,
    effects: [
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
  [ID.THROW_SHIELD]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Static Shield',
    castTimeMs: 750,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Throw Shield',
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
  [ID.TOSS_ELIXIR_C_ID_6077]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 16,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.DETONATE_ELIXIR_C]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.DETONATE_ELIXIR_B]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir B'
  },
  [ID.DETONATE_ELIXIR_S]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.DETONATE_ELIXIR_R]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.DETONATE_ELIXIR_U]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_U_ID_6089]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_S_ID_6090]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.TOSS_ELIXIR_R_ID_6091]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 90,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.TOSS_ELIXIR_B_ID_6092]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'Stability',
        duration: 4,
        stacks: 3
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
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir B'
  },
  [ID.HARPOON_TURRET]: {
    interruptCommitMs: 0,
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 4.25,
        hits: 5,
        atMs: 500,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Harpoon Turret',
        actorType: 'summon',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.DETONATE_HARPOON_TURRET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Harpoon Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.AUTOMATIC_FIRE_HARPOON_TURRET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Automatic Fire (Harpoon Turret)',
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
  [ID.DETONATE_ELIXIR_H]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir H'
  },
  [ID.MAGNETIC_INVERSION]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Magnetic Shield',
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Magnetic Inversion',
        actorType: 'player'
      }
    ]
  },
  [ID.DETONATE_ROCKET_TURRET]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Rocket Turret',
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Rocket Turret',
        actorType: 'player'
      }
    ]
  },
  [ID.BLUNDERBUSS]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        atMs: 368,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 9,
        atMs: 368,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5,
        atMs: 368,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.OVERCHARGED_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 14,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 451,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Overcharged Shot',
        actorType: 'player',
        metadata: {
          projectile: true
        }
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 450
        }
      }
    ]
  },
  [ID.THROW_MINE]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    paletteFlipSkillId: ID.DETONATE,
    castTimeMs: 500,
    cooldown: 12,
    rechargeAnchor: 'castStart'
  },
  [ID.DETONATE]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    flipParentName: 'Throw Mine',
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          damageKind: 'explosion'
        },
        name: 'Detonate (engineer skill)',
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
  [ID.DEPLOY_MINE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
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
  [ID.MINE_FIELD]: {
    implemented: true,
    handlerId: 'engineer.mine-field',
    quicknessCastTimeMs: 920,
    cooldown: 17,
    effects: [
      {
        type: 'strike',
        coefficient: 3.85,
        hits: 5,
        name: 'Damage per Mine',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.DETONATE_MINE_FIELD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          skillName: 'Mine Field'
        }
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.REGENERATING_MIST]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 18,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 2
      }
    ],
    toolbeltParentName: 'Healing Turret',
    mechanicSlot: 1
  },
  [ID.ROCKET]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Rocket',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rocket Turret'
  },
  [ID.SURPRISE_SHOT_ENGINEER_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Surprise Shot (engineer skill)',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rifle Turret'
  },
  [ID.NET_ATTACK]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 38,
    effects: [],
    toolbeltParentName: 'Net Turret'
  },
  [ID.RUMBLE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 38,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rumble',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Thumper Turret'
  },
  [ID.THROW_NAPALM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2.0999999999999996,
        hits: 3,
        atMs: 120.24,
        intervalMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Throw Napalm',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Flame Turret'
  },
  [ID.HARPOON_ENGINEER_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Harpoon (engineer skill)',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Harpoon Turret'
  },
  [ID.WITHERING_PLAGUE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.PLAGUE_OF_DARKNESS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.PLAGUE_OF_PESTILENCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
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
  [ID.CONFUSING_SPEECH]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Technobabble'
  },
  [ID.PAIN_TRANSFERENCE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Pain Transference',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Pain Inverter'
  },
  [ID.VENT_RADIATION]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 9,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Radiation Field'
  },
  [ID.INVIGORATING_ROAR]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 50,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Battle Roar'
  },
  [ID.BOOBY_TRAP_CHARR_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Booby Trap (charr skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Shrapnel Mine'
  },
  [ID.HIDDEN_PISTOLS]: {
    implemented: true,
    castTimeMs: 1750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Hidden Pistols',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Hidden Pistol'
  },
  [ID.BLESSING_OF_DWAYNA]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 40,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Prayer to Dwayna',
    mechanicSlot: 1
  },
  [ID.BLESSING_OF_KORMIR]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 30,
    effects: [],
    toolbeltParentName: 'Prayer to Kormir'
  },
  [ID.BLESSING_OF_LYSSA]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 35,
    effects: [],
    toolbeltParentName: 'Prayer to Lyssa'
  },
  [ID.EAT_WURM_EGG]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 6,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Call Wurm'
  },
  [ID.EAT_OWL_EGG]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Call Owl'
  },
  [ID.THROW_VINE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Throw Vine',
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
    ],
    toolbeltParentName: 'Seed Turret'
  },
  [ID.VINE_SHIELD]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Grasping Vines'
  },
  [ID.LEAFY_BANDAGE]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 40,
    effects: [],
    toolbeltParentName: 'Healing Seed',
    mechanicSlot: 1
  },
  [ID.LESSER_ELIXIR_B]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 24,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.ALLY_WARD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.STATIC_DISCHARGE_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Static Discharge (trait skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.PLAGUE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 105,
    effects: [
      {
        type: 'strike',
        coefficient: 0.39,
        hits: 1,
        name: 'Plague',
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
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SNOWMAN_TURRET_SKILL]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 20,
    effects: []
  },
  [ID.DETONATE_SNOWMAN_TURRET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.DROP_MINE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Drop Mine',
        actorType: 'player'
      }
    ]
  },
  [ID.MAGNETIC_BOMB_TRAIT_SKILL]: {
    interruptCommitMs: 0,
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 300
        }
      }
    ]
  },
  [ID.SUPERSPEED_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.FIRE_SHIELD_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.MAGNETIC_AURA_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.GLUE_TRAIL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
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
  [ID.A_E_D]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 24,
    effects: []
  },
  [ID.STATIC_SHOCK]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Static Shock',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'control',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ],
    toolbeltParentName: 'A.E.D.',
    mechanicSlot: 1
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.95,
        hits: 1,
        name: 'Bunker Down (trait skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.OVERFUELED_FLAME_JET]: {
    implemented: true,
    castTimeMs: 2250,
    cooldown: 1,
    effects: []
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Detonate Supply Crate Turrets',
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_BOOTS_ID_29522]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Rocket Boots',
        actorType: 'player'
      }
    ]
  },
  [ID.UTILITY_GOGGLES_ID_29591]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.INVISIBLE_ANALYSIS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.CLEANSING_PULSE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.MED_PACK_DROP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 50,
    effects: [],
    toolbeltParentName: 'Supply Crate',
    mechanicSlot: 5
  },
  [ID.DETONATE_ELIXIR_X]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir X (underwater)'
  },
  [ID.NEGATIVE_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Negative Bash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.LESSER_UTILITY_GOGGLES]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SHOCK_SHIELD]: {
    implemented: true,
    castTimeMs: 1750,
    cooldown: 18,
    blockDuration: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 240,
        intervalMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Shock Shield',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aim-Assisted Rocket (trait skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.DROP_GUNK]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Drop Gunk',
        actorType: 'player'
      }
    ]
  },
  [ID.PERSONAL_BATTERING_RAM_ID_29991]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 5,
    ammo: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Personal Battering Ram',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 450
        }
      }
    ]
  },
  [ID.ELECTRO_WHIRL]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 6,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 2,
        atMs: 340,
        intervalMs: 340,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Electro-whirl',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      }
    ]
  },
  [ID.BANDAGE_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.FLASHBANG]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Flashbang',
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
    ],
    toolbeltParentName: 'Utility Goggles'
  },
  [ID.OVERCHARGE_SUPPLY_CRATE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    effects: []
  },
  [ID.THROW_MINE_ID_30337]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Throw Mine',
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
  [ID.EQUALIZING_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Equalizing Blow',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.POSITIVE_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Positive Strike',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ROCKET_CHARGE]: {
    implemented: true,
    castTimeMs: 1920,
    unaffectedByQuickness: true,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 640, coefficient: 1.2 },
          { atMs: 1240, coefficient: 1.2 },
          { atMs: 1920, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rocket Charge',
        actorType: 'player'
      }
    ]
  },
  [ID.LONG_FUSED_POWDER_PACK]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Long-Fused Powder Pack',
        actorType: 'player'
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 5,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Thunderclap',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        applications: 5,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 750,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun',
          duration: 1
        }
      }
    ]
  },
  [ID.TOSS_ELIXIR_X]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 60,
    effects: [],
    toolbeltParentName: 'Elixir X',
    mechanicSlot: 5
  },
  [ID.SLICK_SHOES_ID_30828]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    effects: [
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
  [ID.A_E_D_ID_30881]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 24,
    effects: []
  },
  [ID.DEPLOY_MINE_ID_30893]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Deploy Mine',
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
  [ID.THROW_JUNK_DOPPELGANGER]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Throw Junk (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
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
  [ID.ORBITAL_COMMAND_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Orbital Command Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.CONTROLLED_ANALYSIS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.LESSER_ELIXIR_C]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 10,
    effects: []
  },
  [ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Explosive Entrance (trait skill)',
        actorType: 'player'
      }
    ]
  },
  [ID.MACE_SMASH]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mace Smash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 2,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ENERGIZING_SLAM]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 1.85,
        hits: 1,
        name: 'Energizing Slam',
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
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.MACE_BLAST]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    // Mace Blast is both an Explosion for Engineer traits and a leap combo finisher.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Mace Blast',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.MACE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mace Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_FIST_PROTOTYPE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Rocket Fist Prototype',
        actorType: 'player',
        // The fist explodes on impact while the traveling fist is a physical projectile finisher.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
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
  [ID.RIFLE_BURST_GRENADE]: {
    implemented: true,
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Rifle Burst Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ]
  },
  [ID.RADIANT_ARC_ID_69565]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 14,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc (non-holosmith)',
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
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SUN_RIPPER_ID_69906]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.02,
        hits: 1,
        name: 'Sun Ripper (non-holosmith)',
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE_ID_70514]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.96,
        hits: 1,
        name: 'Sun Edge (non-holosmith)',
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.GLEAM_SABER_ID_70771]: {
    implemented: true,
    handlerId: 'engineer.gleam-saber',
    quicknessCastTimeMs: 720,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 1,
        name: 'Gleam Saber (non-holosmith)',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_ID_71121]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Refraction Cutter (non-holosmith) — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 2,
        atMs: 34,
        intervalMs: 51,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        applications: 2,
        atMs: 34,
        intervalMs: 51,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_OF_LIQUID_WRATH]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1,
        name: 'Essence of Liquid Wrath',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ARC_DETONATOR]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Arc Detonator — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Shock Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_OF_LIVING_SHADOWS]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 645,
        hits: 645,
        atMs: 0.693333333333,
        intervalMs: 0.693333333333,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Essence of Living Shadows',
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_OF_BORROWED_TIME]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Essence of Borrowed Time',
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
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.ESSENCE_OF_ANIMATED_SAND]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Essence of Animated Sand',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3
      }
    ]
  },
  [ID.PUNCTURING_JAB]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Puncturing Jab',
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
  [ID.DEVASTATOR]: {
    implemented: true,
    handlerId: 'engineer.devastator',
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Devastator',
        actorType: 'player',
        // Only the primary impact is the blast; focused follow-up packets must not create extra combos.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.ROILING_SKIES]: {
    implemented: true,
    handlerId: 'engineer.roiling-skies',
    castTimeMs: 1000,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Roiling Skies',
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
  [ID.AMPLIFYING_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.99,
        hits: 1,
        name: 'Amplifying Slice',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.LIGHTNING_ROD]: {
    implemented: true,
    handlerId: 'engineer.lightning-rod',
    castTimeMs: 400,
    unaffectedByQuickness: true,
    cooldown: 12,
    effects: []
  },
  [ID.FOCUSED_DEVASTATION]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 6,
        name: 'Focused Devastation',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 6,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.RENDING_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rending Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.CONDUIT_SURGE]: {
    implemented: true,
    handlerId: 'engineer.conduit-surge',
    castTimeMs: 520,
    unaffectedByQuickness: true,
    cooldown: 5,
    // The dash completes one leap combo at impact, where the replacement handler also applies Focused.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: []
  },
  [ID.ELECTRIC_ARTILLERY]: {
    implemented: true,
    handlerId: 'engineer.electric-artillery',
    quicknessCastTimeMs: 520,
    cooldown: 1,
    effects: []
  }
});
const extraSkills: Skill[] = [
  ...ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS,
  {
    id: ID.DODGE,
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    handlerId: 'engineer.dodge',
    // Quickness does not shorten the fixed evade animation recorded for ordinary dodge rolls.
    unaffectedByQuickness: true,
    castTimeMs: 800,
    cooldown: 0,
    implemented: true,
    effects: []
  },
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Stow the active engineer kit and return to equipped weapons.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    handlerId: 'engineer.kit-stow',
    castTimeMs: 0,
    cooldown: 0,
    rechargeAnchor: 'castStart',
    implemented: true,
    effects: []
  }
];
export const ENGINEER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
