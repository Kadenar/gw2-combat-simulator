/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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
  [ID.STEAL_ID_13109]: {
    implemented: true,
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
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
  }
});
