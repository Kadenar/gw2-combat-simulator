/**
 * Authoritative necromancer simulation mechanics.
 *
 * Generated API metadata supplies identity and presentation only. Every
 * field that can affect simulation results is defined in this file.
 */

import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

export const NECROMANCER_SKILL_MECHANICS = Object.freeze({
  [ID.WELL_OF_BLOOD]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
  },
  [ID.GHASTLY_CLAWS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.6,
        "hits": 8
      }
    ],
    "lifeForceGain": 12,
  },
  [ID.DARK_PACT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 10
      }
    ],
    "lifeForceGain": 5,
  },
  [ID.GRASPING_DEAD]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 10
      }
    ],
  },
  [ID.SUMMON_BONE_FIEND]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion"
  },
  [ID.PUTRID_EXPLOSION]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion-command"
  },
  [ID.SUMMON_BONE_MINIONS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion"
  },
  [ID.SUMMON_FLESH_WURM]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion",
    "flipSkillId": 10600
  },
  [ID.BLOOD_IS_POWER]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 4,
        "duration": 15
      }
    ],
  },
  [ID.WELL_OF_CORRUPTION]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 6,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      }
    ],
    "lifeForceGain": 1,
  },
  [ID.WELL_OF_SUFFERING]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 6,
        "hits": 6,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 5,
        "stacks": 2
      }
    ],
  },
  [ID.SUMMON_BLOOD_FIEND]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "handlerId": "necromancer.minion"
  },
  [ID.CONSUME_CONDITIONS]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 4,
        "stacks": 5
      }
    ],
  },
  [ID.PLAGUELANDS]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.39,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 5
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 5
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 10
      },
      {
        "type": "blind"
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 2
        }
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1
      }
    ],
  },
  [ID.LICH_FORM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "lifeForceGain": 15,
    "cooldown": 120,
    "handlerId": "necromancer.lich"
  },
  [ID.PUTRID_CURSE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 6
      }
    ],
  },
  [ID.LIFE_BLAST]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      }
    ],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "death",
    "shroudSlot": 1,
    "specialization": "",
    "flipSkillId": null
  },
  [ID.SPINAL_SHIVERS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 1,
        "name": "Spinal Shivers â€” Damage—Three Boons"
      },
      {
        "type": "strike",
        "coefficient": 3.5,
        "hits": 1,
        "name": "Spinal Shivers â€” Damage—Two Boons"
      },
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Spinal Shivers â€” Damage—One Boon"
      },
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Spinal Shivers â€” Damage—No Boons"
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 5
        }
      }
    ],
  },
  [ID.WAIL_OF_DOOM]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
  },
  [ID.LOCUST_SWARM]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 0,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 500,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 1000,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 1500,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 2000,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 2500,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 3000,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 3500,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 4000,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 4500,
        "name": "Locust Swarm â€” Life Siphon",
        "metadata": {
          "flatStrikeBase": 37,
          "flatStrikePowerCoeff": 0.012,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
    "lifeForceGain": 1.5,
  },
  [ID.RENDING_CLAWS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 2
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 7,
        "stacks": 2
      }
    ],
  },
  [ID.PLAGUE_SIGNET]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.RIGOR_MORTIS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion-command"
  },
  [ID.DEATH_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 10,
    "handlerId": "necromancer.shroud"
  },
  [ID.TASTE_OF_DEATH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "handlerId": "necromancer.minion-command"
  },
  [ID.SPECTRAL_ARMOR]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.END_DEATH_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 0,
    "handlerId": "necromancer.shroud"
  },
  [ID.DOOM]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
    "type": "Profession",
    "slot": "Weapon_3",
    "shroud": "death",
    "shroudSlot": 3,
    "specialization": "",
  },
  [ID.SUMMON_SHADOW_FIEND]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.minion"
  },
  [ID.HAUNT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "lifeForceGain": 10,
    "handlerId": "necromancer.minion-command"
  },
  [ID.LIFE_TRANSFER]: {
    "implemented": true,
    "castTimeMs": 2000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.825,
        "hits": 9,
        "atMs": 222,
        "intervalMs": 222,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 222,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 444,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 666,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 888,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 1110,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 1332,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 1554,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 1776,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 3,
        "atMs": 1998,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
    "type": "Profession",
    "slot": "Weapon_4",
    "shroud": "death",
    "shroudSlot": 4,
    "specialization": "",
    "lifeForceGain": 9
  },
  [ID.NECROTIC_GRASP]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ],
    "lifeForceGain": 4,
  },
  [ID.NECROTIC_TRAVERSAL]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.minion-command",
    "lifeForceGain": 10
  },
  [ID.CORRUPT_BOON]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 6
      }
    ],
  },
  [ID.DARK_PATH]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.25,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 8
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 3
        }
      }
    ],
    "type": "Profession",
    "slot": "Weapon_2",
    "shroud": "death",
    "shroudSlot": 2,
    "specialization": "",
    "handlerId": "necromancer.flip"
  },
  [ID.CHILLBLAINS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 8
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        }
      }
    ],
  },
  [ID.EPIDEMIC]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 6,
        "stacks": 3
      }
    ],
  },
  [ID.WELL_OF_DARKNESS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.800000000000001,
        "hits": 6,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      },
      {
        "type": "blind"
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 2
        }
      }
    ],
  },
  [ID.SPECTRAL_RING]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
    "lifeForceGain": 4,
  },
  [ID.WELL_OF_POWER]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.SIGNET_OF_UNDEATH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "lifeForceGain": 0,
    "handlerId": "necromancer.signet-undeath"
  },
  [ID.SIGNET_OF_THE_LOCUST]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ],
  },
  [ID.SPECTRAL_GRASP]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        }
      }
    ],
    "lifeForceGain": 15,
  },
  [ID.SIGNET_OF_SPITE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 10
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 2,
        "duration": 10
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 6
      },
      {
        "type": "blind"
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 10,
        "stacks": 5
      }
    ],
  },
  [ID.GRIM_SPECTER]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 750,
        "name": "Grim Specter â€” Life Steal",
        "metadata": {
          "flatStrikeBase": 778,
          "flatStrikePowerCoeff": 0.2,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 1750,
        "name": "Grim Specter â€” Life Steal",
        "metadata": {
          "flatStrikeBase": 778,
          "flatStrikePowerCoeff": 0.2,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 2750,
        "name": "Grim Specter â€” Life Steal",
        "metadata": {
          "flatStrikeBase": 778,
          "flatStrikePowerCoeff": 0.2,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 3750,
        "name": "Grim Specter â€” Life Steal",
        "metadata": {
          "flatStrikeBase": 778,
          "flatStrikePowerCoeff": 0.2,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "atMs": 4750,
        "name": "Grim Specter â€” Life Steal",
        "metadata": {
          "flatStrikeBase": 778,
          "flatStrikePowerCoeff": 0.2,
          "noCrit": true,
          "damageKind": "life-steal"
        },
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
  },
  [ID.RIPPLE_OF_HORROR]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
    "handlerId": "necromancer.flip"
  },
  [ID.DEATHLY_CLAWS]: {
    "implemented": true,
    "castTimeMs": 1100,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.34,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 3
      }
    ],
  },
  [ID.LICHS_GAZE]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        }
      }
    ],
    "cooldown": 8
  },
  [ID.SUMMON_MADNESS]: {
    "implemented": true,
    "castTimeMs": 1500,
    "effects": [],
    "handlerId": "necromancer.summon-madness"
  },
  [ID.SUMMON_FLESH_GOLEM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "handlerId": "necromancer.minion"
  },
  [ID.CHARGE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "handlerId": "necromancer.minion-command"
  },
  [ID.SPECTRAL_WALK]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
    "lifeForceGain": 4,
  },
  [ID.SPECTRAL_RECALL]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
  },
  [ID.CORROSIVE_POISON_CLOUD]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 4,
        "duration": 2
      }
    ],
  },
  [ID.BLOOD_CURSE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.35,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5
      }
    ],
  },
  [ID.RENDING_CURSE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.35,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5
      }
    ],
  },
  [ID.UNHOLY_FEAST]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1
      }
    ],
  },
  [ID.NECROTIC_SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 2
      }
    ],
  },
  [ID.NECROTIC_STAB]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1
      }
    ],
    "lifeForceGain": 4,
  },
  [ID.NECROTIC_BITE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.3,
        "hits": 1
      }
    ],
    "lifeForceGain": 8,
  },
  [ID.DEATHLY_SWARM]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      },
      {
        "type": "blind"
      }
    ],
  },
  [ID.ENFEEBLING_BLOOD]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 10
      }
    ],
  },
  [ID.FEAST_OF_CORRUPTION]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4
      }
    ],
    "lifeForceGain": 8,
    "flipSkillId": null
  },
  [ID.DHUUMFIRE_BLAST]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3
      }
    ],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "death",
    "shroudSlot": 1,
    "specialization": "",
    "flipParentId": null,
    "simulatorExcluded": true
  },
  [ID.REAPERS_MARK]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
  },
  [ID.PUTRID_MARK]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.32,
        "hits": 1
      }
    ],
  },
  [ID.MARK_OF_BLOOD]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 8
      }
    ],
  },
  [ID.TAINTED_SHACKLES]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 12,
        "atMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 12,
        "atMs": 1250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 12,
        "atMs": 2250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 12,
        "atMs": 3250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "atMs": 4250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
    "type": "Profession",
    "slot": "Weapon_5",
    "shroud": "death",
    "shroudSlot": 5,
    "specialization": "",
  },
  [ID.SIGNET_OF_VAMPIRISM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "handlerId": "necromancer.signet-vampirism"
  },
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.LIFE_REND]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      }
    ],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "reaper",
    "shroudSlot": 1,
    "specialization": "Reaper",
  },
  [ID.LIFE_SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1
      }
    ],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "reaper",
    "shroudSlot": 1,
    "specialization": "Reaper",
  },
  [ID.NOTHING_CAN_SAVE_YOU]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 10,
        "stacks": 6
      }
    ],
  },
  [ID.DUSK_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      }
    ],
    "lifeForceGain": 2,
  },
  [ID.TERRIFY]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
    "type": "Profession",
    "slot": "Weapon_3",
    "shroud": "reaper",
    "shroudSlot": 3,
    "specialization": "Reaper",
    "cooldown": 0
  },
  [ID.GRASPING_DARKNESS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.3,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        }
      }
    ],
    "lifeForceGain": 10,
  },
  [ID.NIGHTFALL]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.15,
        "hits": 1
      },
      {
        "type": "blind"
      }
    ],
    "lifeForceGain": 7,
  },
  [ID.CHILLING_SCYTHE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 2
        }
      }
    ],
    "lifeForceGain": 5,
  },
  [ID.INFUSING_TERROR]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_3",
    "shroud": "reaper",
    "shroudSlot": 3,
    "specialization": "Reaper",
    "handlerId": "necromancer.flip"
  },
  [ID.CHILLED_TO_THE_BONE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        }
      }
    ],
  },
  [ID.GRAVEDIGGER]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 1
      }
    ],
  },
  [ID.LIFE_REAP]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      }
    ],
    "lifeForceGain": 1.5,
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "reaper",
    "shroudSlot": 1,
    "specialization": "Reaper",
  },
  [ID.YOUR_SOUL_IS_MINE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      }
    ],
    "lifeForceGain": 15,
  },
  [ID.SOUL_SPIRAL]: {
    "implemented": true,
    "castTimeMs": 2750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 8.4,
        "hits": 12,
        "atMs": 229,
        "intervalMs": 229,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 229,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 458,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 687,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 916,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 1145,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 1374,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 1603,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 1832,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 2061,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 2290,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 2519,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "atMs": 2748,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
    "type": "Profession",
    "slot": "Weapon_4",
    "shroud": "reaper",
    "shroudSlot": 4,
    "specialization": "Reaper",
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 1,
        "metadata": {
          "thresholdCoefficients": {
            "25": 8,
            "50": 6
          }
        }
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "stun"
        }
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 1
        }
      }
    ],
    "type": "Profession",
    "slot": "Weapon_5",
    "shroud": "reaper",
    "shroudSlot": 5,
    "specialization": "Reaper",
  },
  [ID.SUFFER]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 3
        }
      }
    ],
  },
  [ID.RISE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      }
    ],
  },
  [ID.REAPERS_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 10,
    "specialization": "Reaper",
    "handlerId": "necromancer.shroud"
  },
  [ID.FADING_TWILIGHT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      }
    ],
    "lifeForceGain": 2,
  },
  [ID.DEATHS_CHARGE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 9,
        "atMs": 100,
        "intervalMs": 100,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 1.625,
        "hits": 1,
        "atMs": 1250,
        "name": "Death's Charge â€” Final Strike",
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "blind"
      }
    ],
    "type": "Profession",
    "slot": "Weapon_2",
    "shroud": "reaper",
    "shroudSlot": 2,
    "specialization": "Reaper",
  },
  [ID.DEATH_SPIRAL]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 10,
        "stacks": 12
      }
    ],
  },
  [ID.EXIT_REAPERS_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 0,
    "specialization": "Reaper",
    "handlerId": "necromancer.shroud"
  },
  [ID.TRAIL_OF_ANGUISH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 4
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.NEFARIOUS_FAVOR]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "specialization": "Scourge",
    "lifeForceCost": 21,
    "handlerId": "necromancer.shade"
  },
  [ID.SERPENT_SIPHON]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 10
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      }
    ],
  },
  [ID.MANIFEST_SAND_SHADE_ID_42297]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.666,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 2
      }
    ],
    "simulatorAliasOfId": 44946,
    "simulatorExcluded": true,
    "flipSkillId": null
  },
  [ID.GHASTLY_BREACH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.5,
        "hits": 5,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      }
    ],
  },
  [ID.SAND_SWELL]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      }
    ],
  },
  [ID.DESICCATE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      }
    ],
    "lifeForceGain": 12,
  },
  [ID.SAND_FLARE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 3,
        "duration": 8
      }
    ],
  },
  [ID.SAND_CASCADE]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "specialization": "Scourge",
    "lifeForceCost": 27,
    "handlerId": "necromancer.shade"
  },
  [ID.OPPRESSIVE_COLLAPSE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 9
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.GARISH_PILLAR]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "specialization": "Scourge",
    "lifeForceCost": 40,
    "handlerId": "necromancer.shade"
  },
  [ID.DESERT_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "specialization": "Scourge",
    "lifeForceCost": 50,
    "handlerId": "necromancer.shade",
    "flipSkillId": null
  },
  [ID.MANIFEST_SAND_SHADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "cooldown": 15,
    "ammo": 3,
    "ammoRecharge": 15,
    "specialization": "Scourge",
    "handlerId": "necromancer.shade"
  },
  [ID.MARCH_OF_UNDEATH]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
  },
  [ID.HARROWING_WAVE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 8
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 2,
        "duration": 6
      }
    ],
    "lifeForceGain": 5,
  },
  [ID.MANIFEST_SAND_SHADE_ID_46473]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.666,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 2
      }
    ],
    "simulatorAliasOfId": 44946,
    "simulatorExcluded": true,
    "flipSkillId": null
  },
  [ID.MANIFEST_SAND_SHADE_ID_46474]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.666,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 2
      }
    ],
    "simulatorAliasOfId": 44946,
    "simulatorExcluded": true,
    "flipSkillId": null
  },
  [ID.DEVOURING_DARKNESS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.928,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4
      }
    ],
    "lifeForceGain": 8,
    "flipParentId": null
  },
  [ID.SANDSTORM_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "specialization": "Scourge",
    "lifeForceCost": 35,
    "handlerId": "necromancer.shade",
    "flipParentId": null
  },
  [ID.SOUL_GRASP]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 6,
        "stacks": 5
      }
    ],
    "lifeForceGain": 11,
  },
  [ID.DARK_PURSUIT]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_2",
    "shroud": "death",
    "shroudSlot": 2,
    "specialization": "",
    "cooldown": 0
  },
  [ID.VILE_BLAST]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 5,
        "duration": 6
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
    "lifeForceGain": 4,
  },
  [ID.WEEPING_SHOTS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4000000000000004,
        "hits": 6
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 6,
        "duration": 4
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 6,
        "stacks": 6
      }
    ],
    "lifeForceGain": 9,
  },
  [ID.ELIXIR_OF_BLISS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.elixir"
  },
  [ID.VICIOUS_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.65,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 4
      }
    ],
  },
  [ID.ELIXIR_OF_RISK]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "cooldown": 20,
    "handlerId": "necromancer.elixir"
  },
  [ID.VORACIOUS_ARC]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_4",
    "shroud": "harbinger",
    "shroudSlot": 4,
    "specialization": "Harbinger",
    "handlerId": "necromancer.blight-skill"
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 0,
    "specialization": "Harbinger",
    "handlerId": "necromancer.shroud"
  },
  [ID.VITAL_DRAW]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 3,
        "atMs": 333,
        "intervalMs": 333,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "float"
        }
      }
    ],
    "lifeForceGain": 3,
    "type": "Profession",
    "slot": "Weapon_5",
    "shroud": "harbinger",
    "shroudSlot": 5,
    "specialization": "Harbinger",
  },
  [ID.HARBINGER_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 10,
    "specialization": "Harbinger",
    "handlerId": "necromancer.shroud"
  },
  [ID.TAINTED_BOLTS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 2,
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3
      }
    ],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "harbinger",
    "shroudSlot": 1,
    "specialization": "Harbinger",
  },
  [ID.DARK_BARRAGE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 6,
        "atMs": 125,
        "intervalMs": 125,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 125,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 375,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 625,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 3,
        "atMs": 750,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
    "type": "Profession",
    "slot": "Weapon_2",
    "shroud": "harbinger",
    "shroudSlot": 2,
    "specialization": "Harbinger",
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.elixir"
  },
  [ID.ELIXIR_OF_AMBITION]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.elixir"
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.elixir"
  },
  [ID.ELIXIR_OF_PROMISE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "handlerId": "necromancer.elixir"
  },
  [ID.DEVOURING_CUT]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_3",
    "shroud": "harbinger",
    "shroudSlot": 3,
    "specialization": "Harbinger",
    "handlerId": "necromancer.blight-skill"
  },
  [ID.LIFE_SIPHON]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.6999999999999997,
        "hits": 9
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8
      }
    ],
  },
  [ID.PATH_OF_GLUTTONY]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      }
    ],
  },
  [ID.HUNGERING_MAELSTROM]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.75,
        "hits": 1
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 5
      }
    ],
  },
  [ID.ENERVATION_ECHO]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1
      }
    ],
  },
  [ID.GORGE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      }
    ],
  },
  [ID.RAVENOUS_WAVE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      }
    ],
    "lifeForceGain": 12,
  },
  [ID.SATIATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      }
    ],
  },
  [ID.CONSUME]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 5
      }
    ],
  },
  [ID.ENERVATION_BLADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1
      }
    ],
  },
  [ID.DEVOURING_VISAGE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "fear"
        }
      }
    ],
    "lifeForceGain": 10,
  },
  [ID.GORMANDIZE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 5
        }
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 5
      }
    ],
  },
  [ID.EXTIRPATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.8,
        "hits": 1
      }
    ],
    "lifeForceGain": 12,
  },
  [ID.DARK_SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      }
    ],
  },
  [ID.ADDLE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.9,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
    "lifeForceGain": 10,
  },
  [ID.DEADLY_SLICE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      }
    ],
  },
  [ID.SINISTER_STAB]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 2
        }
      }
    ],
    "lifeForceGain": 5,
  },
  [ID.PERFORATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.5,
        "hits": 7
      }
    ],
  },
  [ID.ISOLATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 3
        }
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 8
      }
    ],
  },
  [ID.DISTRESS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [],
  },
  [ID.INNERVATE_PRESERVATION]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.innervate"
  },
  [ID.SUMMON_SPIRITS]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_5",
    "shroud": "ritualist",
    "shroudSlot": 5,
    "specialization": "Ritualist",
    "handlerId": "necromancer.ritualist"
  },
  [ID.PRESERVATION]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_4",
    "shroud": "ritualist",
    "shroudSlot": 4,
    "specialization": "Ritualist",
    "handlerId": "necromancer.ritualist"
  },
  [ID.INNERVATE_WANDERLUST]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.innervate"
  },
  [ID.NIGHTMARE_WEAPON]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 2
      }
    ],
  },
  [ID.WEAPON_OF_WARDING]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.ANGUISH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_2",
    "shroud": "ritualist",
    "shroudSlot": 2,
    "specialization": "Ritualist",
    "handlerId": "necromancer.ritualist"
  },
  [ID.EXIT_RITUALISTS_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 0,
    "specialization": "Ritualist",
    "handlerId": "necromancer.shroud"
  },
  [ID.XINRAES_WEAPON]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ],
  },
  [ID.WANDERLUST]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_3",
    "shroud": "ritualist",
    "shroudSlot": 3,
    "specialization": "Ritualist",
    "handlerId": "necromancer.ritualist"
  },
  [ID.SPLINTER_WEAPON]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1
      }
    ],
  },
  [ID.INNERVATE_ANGUISH]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.innervate"
  },
  [ID.WEAPON_OF_REMEDY]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [],
  },
  [ID.ESSENCE_BLAST]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [],
    "type": "Profession",
    "slot": "Weapon_1",
    "shroud": "ritualist",
    "shroudSlot": 1,
    "specialization": "Ritualist",
    "handlerId": "necromancer.ritualist"
  },
  [ID.RITUALISTS_SHROUD]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "cooldown": 10,
    "specialization": "Ritualist",
    "handlerId": "necromancer.shroud"
  },
  [ID.RESILIENT_WEAPON]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [],
  },
});

export const NECROMANCER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(NECROMANCER_SKILL_MECHANICS).map(Number),
);

export const NECROMANCER_EXTRA_SKILLS = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    name: "Swap Weapons",
    description: "Swap between weapon sets. The swap has a 10-second recharge.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    castTimeMs: 50,
    quicknessCastTimeMs: 50,
    rechargeAnchor: "castStart",
    cooldown: 10,
    implemented: true,
    handlerId: "necromancer.weapon-swap",
    effects: [],
  }),
  Object.freeze({
    id: ID.EXIT_LICH_FORM,
    name: "Exit Lich Form",
    description: "Leave Lich Form and return to your normal skill bar.",
    icon:
      "https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png",
    type: "Profession",
    slot: "Profession_1",
    castTimeMs: 0,
    cooldown: 0,
    implemented: true,
    handlerId: "necromancer.lich",
    flipParentId: ID.LICH_FORM,
    flipParent: "Lich Form",
    effects: [],
  }),
]);

// Formula data used by custom handlers. Handler code owns state transitions and
// event scheduling; all damage and condition values live here with skill data.
export const NECROMANCER_HANDLER_MECHANICS = Object.freeze({
  signetOfVampirism: Object.freeze({
    passive: Object.freeze({
      interval: 3,
      flatStrikeBase: 129,
      flatStrikePowerCoeff: 0.03,
    }),
    active: Object.freeze({
      hits: 6,
      interval: 1,
      flatStrikeBase: 163,
      flatStrikePowerCoeff: 0.05,
    }),
  }),
  traitStrikeCoefficient: Object.freeze({
    [TRAIT.SPITEFUL_SPIRIT]: 1,
    [TRAIT.EXPLOSIVE_GROWTH]: 1.2,
    [TRAIT.CASCADING_CORRUPTION]: 1,
  }),
  traitProcs: Object.freeze({
    [TRAIT.DHUUMFIRE]: Object.freeze({
      name: "Dhuumfire",
      traitId: TRAIT.DHUUMFIRE,
      condition: "Burning",
      duration: 3,
    }),
    [TRAIT.BARBED_PRECISION]: Object.freeze({
      name: "Barbed Precision",
      traitId: TRAIT.BARBED_PRECISION,
      condition: "Bleeding",
      duration: 2,
      criticalProgress: 0.33,
    }),
    [TRAIT.VAMPIRIC_PRESENCE]: Object.freeze({
      name: "Vampiric Presence",
      traitId: TRAIT.VAMPIRIC_PRESENCE,
      flatStrikeBase: 80,
      flatStrikePowerCoeff: 0.03,
      interval: 1,
    }),
    [TRAIT.DEMONIC_LORE]: Object.freeze({
      name: "Demonic Lore",
      traitId: TRAIT.DEMONIC_LORE,
      condition: "Burning",
      duration: 3,
      interval: 3,
    }),
    [TRAIT.DEATHLY_CHILL]: Object.freeze({
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 3,
      duration: 8,
    }),
    [TRAIT.CHILLING_DARKNESS]: Object.freeze({
      name: "Chilling Darkness",
      traitId: TRAIT.CHILLING_DARKNESS,
      condition: "Chilled",
      duration: 2,
    }),
    [TRAIT.INSIDIOUS_DISRUPTION]: Object.freeze({
      name: "Insidious Disruption",
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: "Torment",
      duration: 8,
    }),
  }),
  minions: Object.freeze({
    [ID.SUMMON_BLOOD_FIEND]: Object.freeze({
      key: "blood-fiend",
      count: 1,
      coefficient: 0.3,
      interval: 2,
      commandId: ID.TASTE_OF_DEATH,
    }),
    [ID.SUMMON_BONE_FIEND]: Object.freeze({
      key: "bone-fiend",
      count: 1,
      coefficient: 0.4,
      interval: 2.4,
      commandId: ID.RIGOR_MORTIS,
    }),
    [ID.SUMMON_BONE_MINIONS]: Object.freeze({
      key: "bone-minion",
      count: 2,
      coefficient: 0.2,
      interval: 1.5,
      commandId: ID.PUTRID_EXPLOSION,
    }),
    [ID.SUMMON_FLESH_WURM]: Object.freeze({
      key: "flesh-wurm",
      count: 1,
      coefficient: 0.6,
      interval: 2.5,
      commandId: ID.NECROTIC_TRAVERSAL,
    }),
    [ID.SUMMON_SHADOW_FIEND]: Object.freeze({
      key: "shadow-fiend",
      count: 1,
      coefficient: 0.3,
      interval: 1.8,
      commandId: ID.HAUNT,
    }),
    [ID.SUMMON_FLESH_GOLEM]: Object.freeze({
      key: "flesh-golem",
      count: 1,
      coefficient: 0.5,
      interval: 2.2,
      commandId: ID.CHARGE,
    }),
  }),
  minionCommands: Object.freeze({
    [ID.RIGOR_MORTIS]: Object.freeze({
      minion: "bone-fiend",
      coefficient: 0.5,
      control: "immobilize",
    }),
    [ID.PUTRID_EXPLOSION]: Object.freeze({
      minion: "bone-minion",
      coefficient: 1,
      condition: Object.freeze(["Poisoned", 1, 5]),
      consumes: 1,
    }),
    [ID.NECROTIC_TRAVERSAL]: Object.freeze({
      minion: "flesh-wurm",
      coefficient: 0,
      condition: Object.freeze(["Poisoned", 2, 9]),
      consumes: 1,
    }),
    [ID.TASTE_OF_DEATH]: Object.freeze({
      minion: "blood-fiend",
      coefficient: 0,
      consumes: 1,
    }),
    [ID.HAUNT]: Object.freeze({
      minion: "shadow-fiend",
      coefficient: 0.4,
      control: "blind",
    }),
    [ID.CHARGE]: Object.freeze({
      minion: "flesh-golem",
      coefficient: 1.5,
      control: "knockdown",
    }),
  }),
  shade: Object.freeze({
    manifest: Object.freeze({
      coefficient: 0.666,
      condition: Object.freeze(["Torment", 1, 2]),
    }),
    sadisticSearing: Object.freeze({
      condition: Object.freeze(["Burning", 1, 4]),
    }),
    garishPillar: Object.freeze({ coefficient: 0.333 }),
    desertShroud: Object.freeze({
      coefficient: 3.15,
      hits: 7,
      interval: 1,
      condition: Object.freeze(["Torment", 1, 5]),
    }),
    sandstormShroud: Object.freeze({
      coefficient: 3,
      delay: 4,
      condition: Object.freeze(["Torment", 6, 5]),
    }),
  }),
  elixirs: Object.freeze({
    coefficientBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: 0.8,
      [ID.ELIXIR_OF_RISK]: 2,
      [ID.ELIXIR_OF_BLISS]: 0.8,
      [ID.ELIXIR_OF_IGNORANCE]: 0.8,
      [ID.ELIXIR_OF_ANGUISH]: 1,
      [ID.ELIXIR_OF_AMBITION]: 1.5,
    }),
    empoweredCoefficientMultiplier: 2,
    durationMultiplier: 2,
    conditionBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: Object.freeze(["Poisoned", 3, 5]),
      [ID.ELIXIR_OF_RISK]: Object.freeze(["Torment", 3, 5]),
    }),
    ambitionConditions: Object.freeze([
      "Bleeding",
      "Burning",
      "Confusion",
      "Poisoned",
      "Torment",
    ]),
    ambitionConditionStacks: 3,
    ambitionConditionDuration: 5,
  }),
  blightSkills: Object.freeze({
    [ID.DEVOURING_CUT]: Object.freeze({
      coefficient: 1,
      empoweredCoefficient: 2,
      empoweredCondition: Object.freeze(["Torment", 5, 5]),
    }),
    [ID.VORACIOUS_ARC]: Object.freeze({
      coefficient: 1.4,
      empoweredCoefficient: 2.8,
      empoweredCondition: Object.freeze(["Torment", 5, 7]),
    }),
  }),
  spirits: Object.freeze({
    [ID.ANGUISH]: Object.freeze({
      key: "anguish",
      attackCoefficient: 0.75,
      summonCoefficient: 3.5,
      summonHits: 7,
      summonInterval: 0.1,
      activeCoefficient: 2,
    }),
    [ID.WANDERLUST]: Object.freeze({
      key: "wanderlust",
      attackCoefficient: 0.6,
      summonCoefficient: 1,
      lingeringCoefficient: 0.72,
      lingeringHits: 4,
      lingeringInterval: 1,
      activeCoefficient: 1,
    }),
    [ID.PRESERVATION]: Object.freeze({
      key: "preservation",
      attackCoefficient: 0,
      activeCoefficient: 0,
    }),
  }),
  spiritAttackInterval: 3,
  essenceBlast: Object.freeze({
    coefficient: 0.75,
    coefficientPerSpirit: 0.15,
  }),
  painfulBond: Object.freeze({
    hits: 10,
    interval: 1,
    flatStrikeBase: 200,
    flatStrikePowerCoeff: 0.4,
  }),
  innervateAnguish: Object.freeze({ coefficient: 1.3 }),
  summonMadness: Object.freeze({
    summons: 8,
    summonInterval: 1,
    attack: Object.freeze({ coefficient: 0.33, delay: 1 }),
    explosion: Object.freeze({ coefficient: 1.25, delay: 6 }),
  }),
});
