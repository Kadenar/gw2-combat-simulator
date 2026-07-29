/**
 * Explicit simulator mechanics keyed by stable GW2 skill ID.
 *
 * This file is authoritative for coefficients, packets, timing, cooldowns,
 * resource costs, and state requirements.
 */

import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

export const THIEF_SKILL_MECHANICS = Object.freeze({
  [ID.THROW_GUNK]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10.8,
        "hits": 6,
        "name": "Throw Gunk",
        "actorType": "player",
        "atMs": 83,
        "intervalMs": 83,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
  },
  [ID.BONE_CRACK]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Bone Crack",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
  },
  [ID.BRANCH_BASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Branch Bash",
        "actorType": "player"
      }
    ],
  },
  [ID.BRANCH_LEAP]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Branch Leap (stolen skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.DRINK_STOLEN_SKILL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.THROW_CHAIN]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Throw Chain (stolen skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.CLUB_SHOCK_WAVE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Club Shock Wave",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 2
        }
      }
    ],
  },
  [ID.THROW_CORAL_SHARD]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Throw Coral Shard",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 6,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 15,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_CRYSTAL_SHARD_STOLEN_SKILL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Throw Crystal Shard (stolen skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 6,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 15,
        "actorType": "player"
      }
    ],
  },
  [ID.CONSUME_PLASMA]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "aegis",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "alacrity",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 2.5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "resistance",
        "duration": 2.5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 10,
        "stacks": 1
      }
    ],
  },
  [ID.EAT_EGG]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.THROW_FEATHERS]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 6,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.THROW_GEAR_STOLEN_SKILL]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Throw Gear (stolen skill)",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
  },
  [ID.ICE_SHARD_STAB]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Ice Shard Stab",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_LAVA_ROCK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Throw Lava Rock",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.MACE_HEAD_CRACK]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Mace Head Crack",
        "actorType": "player"
      }
    ],
  },
  [ID.SHOOT_RIFLE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.05,
        "hits": 1,
        "name": "Shoot Rifle",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 400
        }
      }
    ],
  },
  [ID.THROW_ROCK_STOLEN_SKILL_KNOCKDOWN]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.573,
        "hits": 1,
        "name": "Throw Rock (stolen skill knockdown)",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 2
        }
      }
    ],
  },
  [ID.RUSTY_SCRAP_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.573,
        "hits": 1,
        "name": "Rusty Scrap Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 6,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_SCALE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Throw Scale",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.USE_SCEPTER]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Lightning Whip Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Flame Burst Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
  },
  [ID.HEALING_SEED]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.SKULL_FEAR]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.USE_STAFF]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.203,
        "hits": 1,
        "name": "Chain Lightning Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Fireball Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 1
        }
      }
    ],
  },
  [ID.TOOTH_STAB]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Tooth Stab",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 6,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.BLINDING_TUFT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.EXPLODING_VENOM_SACK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_VINE_STOLEN_SKILL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1,
        "name": "Throw Vine (stolen skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_ROCK_STOLEN_SKILL_DAZE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.05,
        "hits": 1,
        "name": "Throw Rock (stolen skill daze)",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
      }
    ],
  },
  [ID.WHIRLING_AXE]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 3250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Whirling Axe (stolen skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.WHIRLING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Whirling Strike (stolen skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_NET]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.DOUBLE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 2,
        "name": "Double Strike",
        "actorType": "player"
      }
    ],
  },
  [ID.BACKSTAB]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 250,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Front damage",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Dagger",
    "stealthAttack": true,
  },
  [ID.DEATH_BLOSSOM]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8900000000000001,
        "hits": 3,
        "name": "Death Blossom",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 6,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Dagger",
    "requiredOffHand": "Dagger",
  },
  [ID.LARCENOUS_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.17,
        "hits": 1,
        "name": "Larcenous Strike",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Sword",
    "requiredOffHand": "Dagger",
  },
  [ID.BOLA_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.25,
        "hits": 1,
        "name": "Bola Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 1.5,
        "actorType": "player"
      }
    ],
  },
  [ID.SLICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.85,
        "hits": 1,
        "name": "Slice (thief skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.SHADOW_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.315,
        "hits": 1,
        "name": "Shadow Strike — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.3125,
        "hits": 1,
        "name": "Shot Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 4,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Pistol",
    "requiredOffHand": "Dagger",
  },
  [ID.UNLOAD]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 26.88,
        "hits": 8,
        "name": "Unload",
        "actorType": "player",
        "atMs": 188,
        "intervalMs": 188,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1
      }
    ],
    "requiredMainHand": "Pistol",
    "requiredOffHand": "Pistol",
  },
  [ID.HEAD_SHOT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Head Shot",
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL]: {
    "implemented": true,
    "handlerId": "thief.steal",
    "castTimeMs": 0,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.INFILTRATORS_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Infiltrator's Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.FLANKING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Flanking Strike",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Sword",
    "requiredOffHand": "Dagger",
  },
  [ID.DANCING_DAGGER]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1,
        "name": "Dancing Dagger",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.SCORPION_WIRE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 1,
    "ammo": 2,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Scorpion Wire",
        "actorType": "player"
      }
    ],
  },
  [ID.WITHDRAW]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 18,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.TRICK_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1,
        "name": "Trick Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.CHOKING_GAS]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 4,
        "name": "Choking Gas",
        "actorType": "player",
        "atMs": 125,
        "intervalMs": 125,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 1
        }
      }
    ],
  },
  [ID.INFILTRATORS_ARROW]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 6,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 30,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.HIDE_IN_SHADOWS]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 6,
        "stacks": 1
      }
    ],
  },
  [ID.CALTROPS]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 24,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.ROLL_FOR_INITIATIVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SPIDER_VENOM]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.SHADOW_SHOT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Shadow Shot",
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Dagger",
    "requiredOffHand": "Pistol",
  },
  [ID.CLUSTER_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Large Explosion",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_CLUSTER]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 4,
        "name": "Small Explosion",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.BLINDING_POWDER]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.ASSASSINS_SIGNET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SIGNET_OF_MALICE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 12,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SKALE_VENOM]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.PREPARE_PITFALL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SIGNET_OF_SHADOWS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 10,
        "stacks": 1
      }
    ],
  },
  [ID.SIGNET_OF_AGILITY]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.INFILTRATORS_SIGNET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.HASTE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 6,
        "stacks": 1
      }
    ],
  },
  [ID.SHADOW_ASSAULT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 7.199999999999999,
        "hits": 3,
        "name": "Shadow Assault",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
  },
  [ID.FLANKING_DIVE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Flanking Dive — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.625,
        "hits": 1,
        "name": "Damage When Flanking",
        "actorType": "player"
      }
    ],
  },
  [ID.TOW_LINE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Tow Line",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 600
        }
      }
    ],
  },
  [ID.PIERCING_SHOT]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1,
        "name": "Piercing Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.DELUGE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 1,
        "name": "Deluge",
        "actorType": "player"
      }
    ],
  },
  [ID.ESCAPE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.33,
        "hits": 1,
        "name": "Missile Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1,
        "name": "Escape — Packet 2",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.CRIPPLING_SHOT_THIEF_HARPOON_GUN_SKILL]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Crippling Shot (thief harpoon gun skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.INK_SHOT]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Ink Shot",
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.SMOKE_TRAIL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.THIEVES_GUILD]: {
    "implemented": true,
    "handlerId": "thief.thieves-guild",
    "castTimeMs": 1500,
    "cooldown": 120,
    "initiativeCost": 0,
    "effects": [],
    "summonAttack": {
      "coefficient": 1.2,
      "hits": 3,
      "interval": 1,
      "duration": 30
    },
  },
  [ID.DISABLING_SHOT]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Disabling Shot (thief short bow skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.VITAL_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.575,
        "hits": 1,
        "name": "Vital Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.DAGGER_STORM]: {
    "implemented": true,
    "castTimeMs": 2750,
    "cooldown": 60,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.33,
        "hits": 1,
        "name": "Dagger Storm",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 7,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.WILD_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Wild Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.85,
        "hits": 1,
        "name": "Slash (thief skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.DEVOURER_VENOM]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 40,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.ICE_DRAKE_VENOM]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 36,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.HEARTSEEKER]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Above 50%",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1,
        "name": "Below 50%",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.2,
        "hits": 1,
        "name": "Below 25%",
        "actorType": "player"
      }
    ],
  },
  [ID.LOTUS_STRIKE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Lotus Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_ID_13109]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.TWISTING_FANGS]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.26,
        "hits": 2,
        "name": "Twisting Fangs",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 10,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Dagger",
    "requiredOffHand": false,
  },
  [ID.REPEATER]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 7.5,
        "hits": 5,
        "name": "Repeater (offhand empty)",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Pistol",
    "requiredOffHand": false,
  },
  [ID.STAB]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.05,
        "hits": 1,
        "name": "Stab (thief sword skill)",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Sword",
    "requiredOffHand": false,
  },
  [ID.BLACK_POWDER]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 3,
        "name": "Black Powder",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.TACTICAL_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Tactical Strike",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 1
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 3
        }
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 5,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Sword",
    "stealthAttack": true,
  },
  [ID.SNEAK_ATTACK]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 1000,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 9,
        "hits": 5,
        "name": "Sneak Attack",
        "actorType": "player",
        "atMs": 200,
        "intervalMs": 200,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 5,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Pistol",
    "stealthAttack": true,
  },
  [ID.CRIPPLING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.55,
        "hits": 1,
        "name": "Crippling Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.STAB_THIEF_SPEAR_SKILL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.05,
        "hits": 1,
        "name": "Stab (thief spear skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.JAB_THIEF_SKILL]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.15,
        "hits": 1,
        "name": "Jab (thief skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.POISON_TIP_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.33,
        "hits": 1,
        "name": "Poison Tip Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.NINE_TAILED_STRIKE]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 16,
        "hits": 8,
        "name": "Nine-Tailed Strike — Packet 1",
        "actorType": "player",
        "atMs": 188,
        "intervalMs": 188,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Final Strike Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 9,
        "actorType": "player"
      }
    ],
  },
  [ID.DEADLY_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Deadly Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
  },
  [ID.THE_RIPPER]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 750,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "The Ripper",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 4,
        "duration": 10,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
  },
  [ID.INFILTRATORS_RETURN]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [],
  },
  [ID.SURPRISE_SHOT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 250,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.6,
        "hits": 1,
        "name": "Surprise Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Shortbow",
    "stealthAttack": true,
  },
  [ID.BREAK_STANCE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [],
  },
  [ID.BASILISK_VENOM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 40,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.LESSER_CALTROPS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.CLOAK_AND_DAGGER]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1,
        "name": "Cloak and Dagger",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_GUNK_ID_16460]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10.8,
        "hits": 6,
        "name": "Throw Gunk",
        "actorType": "player",
        "atMs": 83,
        "intervalMs": 83,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
  },
  [ID.ICE_WURM_VENOM_TRAP]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 45,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SKELK_VENOM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.IMPACT_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Impact Strike",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
      }
    ],
  },
  [ID.FINISHING_BLOW]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 1,
        "name": "Finishing Blow",
        "actorType": "player"
      }
    ],
  },
  [ID.WEAKENING_WHIRL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6.66,
        "hits": 3,
        "name": "Weakening Whirl",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.UPPERCUT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Uppercut (Daredevil skill)",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 0
        }
      }
    ],
  },
  [ID.STAFF_BASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1,
        "name": "Staff Bash",
        "actorType": "player"
      }
    ],
  },
  [ID.HOOK_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 750,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.65,
        "hits": 1,
        "name": "Hook Strike",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 4
        }
      }
    ],
    "requiredMainHand": "Staff",
    "stealthAttack": true,
  },
  [ID.LESSER_HASTE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 60,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 6,
        "stacks": 1
      }
    ],
  },
  [ID.IMPAIRING_DAGGERS]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6.75,
        "hits": 3,
        "name": "Impairing Daggers",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.CHANNELED_VIGOR]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.PUNISHING_STRIKES]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 8.4,
        "hits": 4,
        "name": "Punishing Strikes",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 4,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.REFLEXIVE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Reflexive Strike",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 2
        }
      }
    ],
  },
  [ID.DEBILITATING_ARC]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Debilitating Arc",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.DISTRACTING_DAGGERS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "ammo": 3,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1,
        "name": "Distracting Daggers",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 0.25
        }
      }
    ],
  },
  [ID.VAULT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Vault",
        "actorType": "player"
      }
    ],
  },
  [ID.STAFF_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.85,
        "hits": 1,
        "name": "Staff Strike",
        "actorType": "player"
      }
    ],
  },
  [ID.BANDITS_DEFENSE]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 16,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.PALM_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Palm Strike — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 3.28,
        "hits": 1,
        "name": "Second Strike Damage",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
  },
  [ID.PULMONARY_IMPACT_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.28,
        "hits": 1,
        "name": "Pulmonary Impact (trait skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.DUST_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 5.4,
        "hits": 3,
        "name": "Dust Strike",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.FIST_FLURRY]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 16,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 18.75,
        "hits": 5,
        "name": "Fist Flurry",
        "actorType": "player",
        "atMs": 200,
        "intervalMs": 200,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.BOUND]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.5,
        "hits": 1,
        "name": "Bound",
        "actorType": "player"
      }
    ],
  },
  [ID.DASH_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 10,
        "stacks": 1
      }
    ],
  },
  [ID.IMPALING_LOTUS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5625,
        "hits": 3,
        "name": "Impaling Lotus",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.ESSENCE_SAP]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Essence Sap (stolen skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_WARMTH]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Warmth",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_RESISTANCE]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Resistance",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "resistance",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.DEATHS_ADVANCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
    "kneelSkill": true,
  },
  [ID.KNEEL]: {
    "implemented": true,
    "handlerId": "thief.kneel",
    "castTimeMs": 500,
    "cooldown": 0.5,
    "initiativeCost": 1,
    "effects": [],
  },
  [ID.DEADLY_AIM]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1,
        "name": "Deadly Aim",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "kneelSkill": true,
  },
  [ID.STEAL_PRECISION]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Precision",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 8,
        "stacks": 1
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_HEALTH]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Health",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_STRENGTH]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Strength",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 12,
        "stacks": 5
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.FREE_ACTION]: {
    "implemented": true,
    "handlerId": "thief.free-action",
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 6,
        "stacks": 1
      }
    ],
    "kneelSkill": true,
  },
  [ID.SHADOW_FLARE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Shadow Flare",
        "actorType": "player"
      }
    ],
  },
  [ID.BINDING_SHADOW]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Binding Shadow",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 15,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.MERCY]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.BRUTAL_AIM]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Brutal Aim",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.SKIRMISHERS_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Skirmisher's Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 6,
        "stacks": 1
      }
    ],
  },
  [ID.DEATHS_RETREAT]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Death's Retreat",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.STEAL_TIME]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Time",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.TRAIL_OF_KNIVES_DOPPELGANGER]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Trail of Knives (Doppelganger)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.SOHOTHIN_BLOSSOM]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 5,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.STEAL_DURABILITY]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Durability",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.DEADEYES_MARK]: {
    "implemented": true,
    "handlerId": "thief.steal",
    "castTimeMs": 0,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.STEAL_DEFENSES]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Defenses",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "aegis",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.DOUBLE_TAP]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.8,
        "hits": 2,
        "name": "Double Tap",
        "actorType": "player",
        "atMs": 375,
        "intervalMs": 375,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 6,
        "stacks": 3
      }
    ],
  },
  [ID.MALICIOUS_DEATHS_JUDGMENT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.67,
        "hits": 1,
        "name": "Malicious Death's Judgment — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.32,
        "hits": 1,
        "name": "Damage on Untargeted Foes",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Rifle",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.STEAL_MOBILITY]: {
    "implemented": true,
    "handlerId": "thief.stolen-skill",
    "castTimeMs": 250,
    "cooldown": 0.5,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Steal Mobility",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 1.5,
        "actorType": "player"
      }
    ],
  },
  [ID.SPOTTERS_SHOT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.3,
        "hits": 1,
        "name": "Spotter's Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 3,
        "stacks": 1
      }
    ],
    "kneelSkill": true,
  },
  [ID.THREE_ROUND_BURST]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6.75,
        "hits": 3,
        "name": "Three Round Burst",
        "actorType": "player",
        "atMs": 333,
        "intervalMs": 333,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 6,
        "stacks": 3
      }
    ],
    "kneelSkill": true,
  },
  [ID.MALICIOUS_RESTORATION]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
    "malicious": true,
  },
  [ID.THROW_GUNK_ID_45094]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10.8,
        "hits": 6,
        "name": "Throw Gunk",
        "actorType": "player",
        "atMs": 83,
        "intervalMs": 83,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.SHADOW_MELD]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 5,
    "ammo": 2,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.SHADOW_SWAP]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Shadow Swap",
        "actorType": "player"
      }
    ],
  },
  [ID.SHADOW_GUST]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 30,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Shadow Gust",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 450
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockback",
          "duration": 450
        }
      }
    ],
  },
  [ID.LIFT_PIN]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.SOUL_STONE_VENOM]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1,
        "name": "Damage per Strike",
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_PLASMA]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.2,
        "hits": 1,
        "name": "Detonate Plasma",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Regeneration",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Vigor",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Might",
        "duration": 10,
        "stacks": 10
      },
      {
        "type": "boon",
        "boon": "Fury",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Swiftness",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Aegis",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Stability",
        "duration": 8,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "Resistance",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.THROW_MAGNETIC_BOMB]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6.300000000000001,
        "hits": 3,
        "name": "Throw Magnetic Bomb",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 360
        }
      }
    ],
  },
  [ID.UNSTABLE_ARTIFACT]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Unstable Artifact",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.HOOKED_SPEAR]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Hooked Spear",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.BURST_OF_SHADOWS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Burst of Shadows",
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.MALICIOUS_DEADLY_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Malicious Deadly Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_RIPPER]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 750,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Malicious Ripper",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 4,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_SURPRISE_SHOT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 250,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.6,
        "hits": 1,
        "name": "Malicious Surprise Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Shortbow",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_SNEAK_ATTACK]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 1000,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 9,
        "hits": 5,
        "name": "Malicious Sneak Attack",
        "actorType": "player",
        "atMs": 200,
        "intervalMs": 200,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Pistol",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_BACKSTAB]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 250,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Front damage",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Dagger",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_TACTICAL_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Malicious Tactical Strike",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 1
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 3
        }
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 5,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Sword",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.PITFALL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 3,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Initial Impact Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Pulse Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 3
        }
      }
    ],
  },
  [ID.THOUSAND_NEEDLES]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 3,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Thousand Needles — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.2,
        "hits": 1,
        "name": "Pulsing Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_ENCHANTED_ICE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Throw Enchanted Ice",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 8,
        "stacks": 2
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 360
        }
      }
    ],
  },
  [ID.THROW_UNSTABLE_REAGENT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Throw Unstable Reagent",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 360
        }
      }
    ],
  },
  [ID.BLESSING_SEED]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.DRINK_AMBROSIA]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "might",
        "duration": 10,
        "stacks": 25
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 10,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 5,
        "stacks": 1
      }
    ],
  },
  [ID.TIME_IN_A_BOTTLE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "alacrity",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.THROW_CURSED_ARTIFACT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10,
        "hits": 5,
        "name": "Throw Cursed Artifact",
        "actorType": "player",
        "atMs": 100,
        "intervalMs": 100,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 2,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.REPEATER_ID_59526]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 7.5,
        "hits": 5,
        "name": "Repeater",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Pistol",
    "requiredOffHand": "Dagger",
  },
  [ID.SHADOW_BOLT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1,
        "name": "Shadow Bolt",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.SIPHON]: {
    "implemented": true,
    "handlerId": "thief.steal",
    "castTimeMs": 500,
    "cooldown": 18,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.ENDLESS_NIGHT]: {
    "implemented": true,
    "castTimeMs": 2250,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.31,
        "hits": 7,
        "name": "Endless Night",
        "actorType": "player",
        "atMs": 321,
        "intervalMs": 321,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 1.5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 1,
        "stacks": 1
      }
    ],
    "requiredMainHand": "Scepter",
    "requiredOffHand": "Pistol",
  },
  [ID.TRIPLE_BOLT]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.35,
        "hits": 3,
        "name": "Triple Bolt",
        "actorType": "player",
        "atMs": 500,
        "intervalMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.TRIPLE_THREAT]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.35,
        "hits": 3,
        "name": "Triple Threat",
        "actorType": "player",
        "atMs": 500,
        "intervalMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Scepter",
    "requiredOffHand": false,
  },
  [ID.ENTER_SHADOW_SHROUD]: {
    "implemented": true,
    "handlerId": "thief.shadow-shroud-enter",
    "castTimeMs": 0,
    "cooldown": 8,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.ETERNAL_NIGHT]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 8,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 7,
        "hits": 2,
        "name": "Eternal Night",
        "actorType": "player",
        "atMs": 500,
        "intervalMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "shadowShroudSkill": true,
  },
  [ID.GRASPING_SHADOWS]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 3,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.666,
        "hits": 1,
        "name": "Grasping Shadows",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "shadowShroudSkill": true,
  },
  [ID.DOUBLE_BOLT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 2,
        "name": "Double Bolt",
        "actorType": "player",
        "atMs": 375,
        "intervalMs": 375,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.DAWNS_REPOSE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 8,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Dawn's Repose",
        "actorType": "player"
      }
    ],
    "shadowShroudSkill": true,
  },
  [ID.WELL_OF_SILENCE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
      }
    ],
  },
  [ID.MIND_SHOCK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 16,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Mind Shock",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 4,
        "stacks": 3
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 1.5
        }
      }
    ],
    "shadowShroudSkill": true,
  },
  [ID.EXIT_SHADOW_SHROUD]: {
    "implemented": true,
    "handlerId": "thief.shadow-shroud-exit",
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.TWILIGHT_COMBO]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Initial Attack",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Secondary Attack",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 5,
        "stacks": 1
      }
    ],
    "requiredMainHand": "Scepter",
    "requiredOffHand": "Dagger",
  },
  [ID.MEASURED_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1,
        "name": "Measured Shot",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Scepter",
    "requiredOffHand": "Pistol",
  },
  [ID.SHADOWFALL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 75,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.5,
        "hits": 3,
        "name": "Shadowfall",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 1
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 50
        }
      }
    ],
  },
  [ID.WELL_OF_SORROW]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.11,
        "hits": 5,
        "name": "Well of Sorrow",
        "actorType": "player",
        "atMs": 150,
        "intervalMs": 150,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.WELL_OF_GLOOM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.WELL_OF_TEARS]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 5,
        "hits": 5,
        "name": "Well of Tears",
        "actorType": "player",
        "atMs": 150,
        "intervalMs": 150,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
  },
  [ID.SHADOWSQUALL]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 2500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 8,
        "name": "Shadowsquall",
        "actorType": "player",
        "atMs": 313,
        "intervalMs": 313,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 2.5,
        "stacks": 1
      }
    ],
    "requiredMainHand": "Scepter",
    "stealthAttack": true,
  },
  [ID.WELL_OF_BOUNTY]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "stability",
        "duration": 5,
        "stacks": 2
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 15,
        "stacks": 8
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 8,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 12,
        "stacks": 1
      }
    ],
  },
  [ID.SHADOW_SAP]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.77,
        "hits": 1,
        "name": "Shadow Sap",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 10,
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 4,
        "stacks": 1
      }
    ],
  },
  [ID.HAUNT_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.075,
        "hits": 1,
        "name": "Haunt Shot",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 5,
        "stacks": 1
      }
    ],
    "shadowShroudSkill": true,
  },
  [ID.SNIPERS_COVER]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [],
    "kneelSkill": true,
  },
  [ID.MALICIOUS_SHADOWSQUALL]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 2500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 8,
        "name": "Malicious Shadowsquall",
        "actorType": "player",
        "atMs": 313,
        "intervalMs": 313,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "Regeneration",
        "duration": 2.5,
        "stacks": 1
      }
    ],
    "requiredMainHand": "Scepter",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.MALICIOUS_HOOK_STRIKE]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.65,
        "hits": 1,
        "name": "Malicious Hook Strike",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 0.75,
        "stacks": 1
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 4
        }
      }
    ],
    "requiredMainHand": "Staff",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.DEATHS_JUDGMENT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.67,
        "hits": 1,
        "name": "Death's Judgment — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.32,
        "hits": 1,
        "name": "Damage on Unmarked Foes",
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Rifle",
    "stealthAttack": true,
  },
  [ID.HELMET_BREAKER]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Helmet Breaker",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
      }
    ],
  },
  [ID.MALICIOUS_CUNNING_SALVO]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Malicious Cunning Salvo",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Axe",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.VENOMOUS_VOLLEY]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.5999999999999996,
        "hits": 3,
        "name": "Venomous Volley",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.SPINNING_AXE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Spinning Axe",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.HARROWING_STORM]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Axe",
    "requiredOffHand": "Dagger",
  },
  [ID.RECALL_AXES]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Axe",
    "requiredOffHand": false,
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Axe",
    "requiredOffHand": "Pistol",
  },
  [ID.SPINNING_AXE_ID_71967]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Spinning Axe",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.CUNNING_SALVO]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 500,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Cunning Salvo",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Axe",
    "stealthAttack": true,
  },
  [ID.ENTANGLING_ASP]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Entangling Asp",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.SHATTERING_ASSAULT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Shattering Assault",
        "actorType": "player"
      },
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.MALICIOUS_ASHEN_ASSAULT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10.8,
        "hits": 6,
        "name": "Malicious Ashen Assault",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
    "malicious": true,
  },
  [ID.DISTRACTING_THROW]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Distracting Throw",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 1.5
        }
      }
    ],
  },
  [ID.UNSUSPECTING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Unsuspecting Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.SHADOW_VEIL]: {
    "implemented": true,
    "castTimeMs": 2000,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [],
  },
  [ID.ASHEN_ASSAULT]: {
    "implemented": true,
    "handlerId": "thief.stealth-attack",
    "castTimeMs": 1500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 10.8,
        "hits": 6,
        "name": "Ashen Assault",
        "actorType": "player",
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 3,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "requiredMainHand": "Spear",
    "stealthAttack": true,
  },
  [ID.MANTIS_STING]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Mantis Sting",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.VAMPIRIC_SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Vampiric Slash — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.2,
        "hits": 1,
        "name": "Vampiric Slash — Packet 2",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.FALLING_SPIDER]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Falling Spider",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3.5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3.5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 4,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.BARBED_SPEAR]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.375,
        "hits": 1,
        "name": "Barbed Spear",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 2.25,
        "actorType": "player"
      }
    ],
  },
  [ID.FORGED_SURFER_DASH]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": []
  },
  [ID.METAL_LEGION_GUITAR]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 2000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Metal Legion Guitar — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Final Smash",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
    "artifactKind": "offensive",
  },
  [ID.METAL_LEGION_GUITAR_ID_76591]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 2000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Metal Legion Guitar — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Final Smash",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
    "artifactKind": "offensive",
  },
  [ID.EXALTED_HAMMER]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Exalted Hammer",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 5,
        "stacks": 1
      }
    ]
  },
  [ID.FORGED_SURFER_DASH_ID_76633]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 1000,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1,
        "name": "Forged Surfer Dash — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Additional Bomb Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3.5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "artifactKind": "offensive",
  },
  [ID.HOLO_DANCER_DECOY]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6,
        "hits": 3,
        "name": "Holo-Dancer Decoy",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 2
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 4
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 8,
        "stacks": 1
      }
    ],
    "artifactKind": "defensive",
  },
  [ID.EXALTED_HAMMER_ID_76702]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Exalted Hammer",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 5,
        "stacks": 1
      }
    ],
    "artifactKind": "defensive",
  },
  [ID.STONE_SUMMIT_CANNON]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 500,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 9,
        "hits": 3,
        "name": "Stone Summit Cannon — Packet 1",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Stone Summit Cannon — Packet 2",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "doubleEdge": true,
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_76733]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 1000,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Zephyrite Sun Crystal",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "artifactKind": "defensive",
  },
  [ID.CANACH_COIN_TOSS]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [],
    "backfire": true
  },
  [ID.EMERGENCY_JADE_SHIELD]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [],
    "backfire": true
  },
  [ID.HOLO_DANCER_DECOY_ID_76800]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6,
        "hits": 3,
        "name": "Holo-Dancer Decoy",
        "actorType": "player",
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 2
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 4
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 8,
        "stacks": 1
      }
    ]
  },
  [ID.INQUEST_PORTAL_DEVICE]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 500,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Inquest Portal Device — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Inquest Portal Device — Packet 2",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 3
        }
      }
    ],
    "doubleEdge": true,
  },
  [ID.CHAK_SHIELD]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 7.5,
        "hits": 5,
        "name": "Chak Shield",
        "actorType": "player"
      }
    ],
    "artifactKind": "defensive",
  },
  [ID.EMERGENCY_JADE_SHIELD_ID_76879]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 0,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1,
        "name": "Emergency Jade Shield",
        "actorType": "player"
      }
    ],
    "doubleEdge": true,
  },
  [ID.ANTIVENOM_DRAUGHT_BACKFIRED]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 10,
    "initiativeCost": 0,
    "effects": [],
    "backfire": true
  },
  [ID.ANTIVENOM_DRAUGHT]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 750,
    "cooldown": 10,
    "initiativeCost": 0,
    "effects": [],
    "doubleEdge": true,
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 1000,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Zephyrite Sun Crystal",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "artifactKind": "defensive",
  },
  [ID.SUMMON_KRYPTIS_TURRET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": []
  },
  [ID.UNSTABLE_SKRITT_BOMB]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Unstable Skritt Bomb",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockback",
          "duration": 180
        }
      }
    ],
    "backfire": true
  },
  [ID.RESHUFFLE]: {
    "implemented": true,
    "handlerId": "thief.reshuffle",
    "castTimeMs": 0,
    "cooldown": 5,
    "initiativeCost": 2,
    "effects": [],
  },
  [ID.STONE_SUMMIT_CANNON_ID_77092]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [],
    "backfire": true
  },
  [ID.SUMMON_KRYPTIS_TURRET_ID_77192]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 500,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 22.4,
        "hits": 8,
        "name": "Summon Kryptis Turret",
        "actorType": "player",
        "atMs": 63,
        "intervalMs": 63,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "artifactKind": "offensive",
  },
  [ID.CANACH_COIN_TOSS_ID_77230]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 0,
    "cooldown": 15,
    "initiativeCost": 0,
    "effects": [],
    "doubleEdge": true,
  },
  [ID.SKRITT_SCUFFLE]: {
    "implemented": true,
    "handlerId": "thief.double-edge",
    "castTimeMs": 500,
    "cooldown": 50,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Skritt Scuffle",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 0
        }
      }
    ],
    "doubleEdge": true,
  },
  [ID.MISTBURN_MORTAR]: {
    "implemented": true,
    "handlerId": "thief.artifact",
    "castTimeMs": 750,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 5,
        "name": "Mistburn Mortar",
        "actorType": "player",
        "atMs": 150,
        "intervalMs": 150,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 1.5,
        "actorType": "player"
      }
    ],
    "artifactKind": "offensive",
  },
  [ID.MISTBURN_MORTAR_ID_77288]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": []
  },
  [ID.INQUEST_PORTAL_DEVICE_BACKFIRED]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "initiativeCost": 0,
    "effects": [],
    "backfire": true
  },
  [ID.SKRITT_SWIPE]: {
    "implemented": true,
    "handlerId": "thief.skritt-swipe",
    "castTimeMs": 0,
    "cooldown": 25,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.LIFT_PIN_HERO_CHALLENGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "initiativeCost": 0,
    "effects": [],
  },
  [ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "initiativeCost": 0,
    "effects": []
  },
  [ID.FLAWLESS_EXECUTION]: {
    "implemented": true,
    "castTimeMs": 1750,
    "cooldown": 0,
    "initiativeCost": 4,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.7700000000000005,
        "hits": 3,
        "name": "Flawless Execution — Packet 1",
        "actorType": "player",
        "atMs": 583,
        "intervalMs": 583,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1,
        "name": "Final Slash Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 9,
        "hits": 6,
        "name": "Projectile Damage",
        "actorType": "player",
        "atMs": 292,
        "intervalMs": 292,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
    "requiredMainHand": "Sword",
    "requiredOffHand": "Pistol",
  },
  [ID.DEATHS_ADVANCE_ID_80278]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "initiativeCost": 2,
    "effects": [
      {
        "type": "buff",
        "kind": "stealth",
        "duration": 3,
        "stacks": 1
      }
    ],
    "kneelSkill": true,
  }
});

const extraSkills = [
  {
    "id": ID.SWAP_WEAPONS,
    "handlerId": "thief.weapon-swap",
    "name": "Swap Weapons",
    "description": "Swap equipped weapon sets.",
    "icon": "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 0,
    "quicknessCastTimeMs": 0,
    "cooldown": 10,
    "rechargeAnchor": "castStart",
    "implemented": true,
    "effects": []
  },
  {
    "id": ID.DODGE,
    "handlerId": "thief.dodge",
    "name": "Dodge",
    "description": "Perform the selected thief dodge.",
    "icon": "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 800,
    "cooldown": 0,
    "implemented": true,
    "effects": [],
    "dodgeEffects": {
      "Bounding Dodger": [
        {
          "type": "strike",
          "sourceId": TRAIT.BOUNDING_DODGER,
          "coefficient": 1.33,
          "hits": 1
        }
      ],
      "Lotus Training": [
        {
          "type": "condition",
          "sourceId": TRAIT.LOTUS_TRAINING,
          "condition": "Bleeding",
          "stacks": 1,
          "duration": 4
        },
        {
          "type": "condition",
          "sourceId": TRAIT.LOTUS_TRAINING,
          "condition": "Torment",
          "stacks": 1,
          "duration": 4
        },
        {
          "type": "condition",
          "sourceId": TRAIT.LOTUS_TRAINING,
          "condition": "Crippled",
          "stacks": 1,
          "duration": 2
        }
      ],
      "Unhindered Combatant": [
        {
          "type": "boon",
          "sourceId": TRAIT.UNHINDERED_COMBATANT,
          "boon": "Swiftness",
          "stacks": 1,
          "duration": 8
        }
      ]
    }
  }
];

export const THIEF_EXTRA_SKILLS = Object.freeze(
  extraSkills.map(skill => Object.freeze(skill)),
);
