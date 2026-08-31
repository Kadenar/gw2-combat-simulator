/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Core heal, utility, elite, turret, and palette-follow-up skill fragments. */
export const ENGINEER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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
  [ID.ELIXIR_R]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 0,
    effects: []
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
  [ID.A_E_D]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 24,
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
  }
});
