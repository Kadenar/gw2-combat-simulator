/**
 * Necromancer skill declarations using the shared canonical skill/effect schema.
 *
 * Generated API metadata supplies identity and presentation. Profession state
 * machines and triggered-effect formulas live in handler-mechanics.js and the
 * explicit strategies under specific/.
 */

import {
  NECROMANCER_SKILL_IDS as ID,
} from "../data/ids.js";

const NECROMANCER_BASE_SKILL_MECHANICS = Object.freeze({
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
        "hits": 8,
        "atMs": 270,
        "intervalMs": 270,
        "timingAnchor": "castStart",
        "timingScale": "cast"
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
    "handlerId": "necromancer.dark-pact",
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
  [ID.BLOOD_IS_POWER]: {
    "implemented": true,
    "castTimeMs": 1000,
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
    "handlerId": "necromancer.corruption",
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
        "atMs": 420,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
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
    "effects": [],
    "handlerId": "necromancer.corruption",
  },
  [ID.PLAGUELANDS]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.51,
        "hits": 9,
        "atMs": 1000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "applications": 9,
        "atMs": 1000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 5,
        "applications": 8,
        "atMs": 2000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 5,
        "applications": 7,
        "atMs": 3000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 4000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 5000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 6000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 7000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 8000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 1,
        "atMs": 9000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "applications": 5,
        "atMs": 5000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 3,
        "applications": 4,
        "atMs": 6000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "blind",
        "applications": 3,
        "atMs": 7000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "duration": 3
        }
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 2,
        "applications": 2,
        "atMs": 8000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 10,
        "atMs": 9000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      }
    ],
    "handlerId": "necromancer.corruption",
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
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.condition-transfer",
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
    "handlerId": "necromancer.corruption",
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
  [ID.WELL_OF_DARKNESS]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.800000000000001,
        "hits": 6,
        "atMs": 420,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
      },
      {
        "type": "blind",
        "applications": 6,
        "atMs": 420,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "duration": 3
        }
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 2,
        "applications": 6,
        "atMs": 420,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      }
    ],
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
    "handlerId": "necromancer.corruption",
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
    "handlerId": "necromancer.condition-transfer",
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
    "handlerId": "necromancer.condition-transfer",
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
    "castTimeMs": 0,
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
        "hits": 1,
        "atMs": 1440,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 4
        },
        "atMs": 1440,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "atMs": 1440,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "controlKind": "pull"
        }
      }
    ],
    "handlerId": "necromancer.grasping-darkness",
  },
  [ID.NIGHTFALL]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.6,
        "hits": 4,
        "atMs": 600,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      },
      {
        "type": "blind",
        "applications": 4,
        "atMs": 600,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "applications": 4,
        "atMs": 600,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      }
    ],
    "handlerId": "necromancer.nightfall",
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
    "handlerId": "necromancer.chilling-scythe",
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
        "hits": 1,
        "atMs": 420,
        "timingAnchor": "castStart",
        "timingScale": "cast"
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
        "atMs": 270,
        "intervalMs": 270,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 270, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 540, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 810, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 1080, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 1350, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 1620, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 1890, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 2160, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 2430, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 2700, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 2970, "condition": "Poisoned", "stacks": 1, "duration": 2 },
          { "atMs": 3240, "condition": "Poisoned", "stacks": 1, "duration": 2 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      }
    ],
    "type": "Profession",
    "slot": "Weapon_4",
    "shroud": "reaper",
    "shroudSlot": 4,
    "specialization": "Reaper",
    "handlerId": "necromancer.soul-spiral",
  },
  [ID.EXECUTIONERS_SCYTHE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 1,
        "atMs": 1260,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "coefficientModifiers": [
          {
            "kind": "target-health-below",
            "threshold": 0.25,
            "multiplier": 2
          },
          {
            "kind": "target-health-below",
            "threshold": 0.5,
            "multiplier": 1.5
          }
        ]
      },
      {
        "type": "control",
        "atMs": 1260,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "metadata": {
          "controlKind": "stun"
        }
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 1,
        "applications": 5,
        "atMs": 1260,
        "intervalMs": 1000,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
      }
    ],
    "type": "Profession",
    "slot": "Weapon_5",
    "shroud": "reaper",
    "shroudSlot": 5,
    "specialization": "Reaper",
    "handlerId": "necromancer.executioners-scythe",
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
    "handlerId": "necromancer.condition-transfer",
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
        "type": "strike",
        "coefficient": 0,
        "hits": 1,
        "name": "Death Spiral — Life Siphon",
        "metadata": {
          "flatStrikeBase": 3517,
          "flatStrikePowerCoeff": 0.01,
          "noCrit": true,
          "damageKind": "life-steal"
        }
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
    "effects": [],
    "lifeForceGain": 8,
    "handlerId": "necromancer.devouring-darkness",
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
        "ticks": [
          {
            "atMs": 250,
            "condition": "Torment",
            "stacks": 1,
            "duration": 3
          },
          {
            "atMs": 500,
            "condition": "Torment",
            "stacks": 1,
            "duration": 3
          }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast"
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
    "handlerId": "necromancer.dark-barrage",
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
        "hits": 9,
        "atMs": 720,
        "intervalMs": 160,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
      }
    ],
    "handlerId": "necromancer.life-siphon",
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
        "hits": 1,
        "atMs": 1080,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 5,
        "atMs": 1080,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
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
        "hits": 5,
        "atMs": 720,
        "intervalMs": 280,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true,
        "metadata": {
          "extendsResolutionHorizon": true
        }
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 4,
        "atMs": 720,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "Might",
        "duration": 8,
        "stacks": 5,
        "atMs": 720,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "persistsAfterInterrupt": true
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
          "controlKind": "fear",
          "duration": 1.5
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
        "hits": 1,
        "atMs": 540,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "event": {
          "duration": 5
        },
        "atMs": 540,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 5,
        "atMs": 540,
        "timingAnchor": "castStart",
        "timingScale": "cast"
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
        "hits": 1,
        "atMs": 1140,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "boon",
        "boon": "Might",
        "duration": 8,
        "stacks": 5,
        "atMs": 1140,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 3,
        "atMs": 1140,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "buff",
        "kind": "extirpation",
        "duration": 4,
        "stacks": 3,
        "atMs": 1140,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ],
    "lifeForceGain": 12,
    "handlerId": "necromancer.extirpate",
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
      }
    ],
    "lifeForceGain": 10,
    "handlerId": "necromancer.addle",
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
    "handlerId": "necromancer.deadly-slice",
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
    "handlerId": "necromancer.sinister-stab",
  },
  [ID.PERFORATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          {
            "atMs": 600,
            "coefficient": 0.5
          },
          {
            "atMs": 720,
            "coefficient": 0.5
          },
          {
            "atMs": 780,
            "coefficient": 0.5
          },
          {
            "atMs": 840,
            "coefficient": 0.5
          },
          {
            "atMs": 960,
            "coefficient": 0.5
          },
          {
            "atMs": 1080,
            "coefficient": 0.5
          },
          {
            "atMs": 1140,
            "coefficient": 0.5
          }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "coefficientModifiers": [
          {
            "kind": "target-health-below",
            "threshold": 0.5,
            "multiplier": 1.2
          }
        ]
      }
    ],
    "handlerId": "necromancer.perforate",
  },
  [ID.ISOLATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1,
        "atMs": 720,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "custom",
        "eventType": "necromancer.chill",
        "atMs": 720,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "event": {
          "duration": 3
        }
      },
      {
        "type": "buff",
        "kind": "target-vulnerability",
        "duration": 8,
        "stacks": 8,
        "atMs": 720,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
    "flipDuration": 3,
    "flipActivationAtMs": 720,
  },
  [ID.DISTRESS]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [],
    "handlerId": "necromancer.distress",
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

/**
 * In-game cast durations measured with Quickness active. Keeping the measured
 * duration alongside its 1.5x base equivalent avoids action-tick rounding
 * changing an observed cast by up to 40 ms.
 */
export const NECROMANCER_QUICKNESS_CAST_TIMES_MS = Object.freeze({
  [ID.LIFE_SIPHON]: 560,
  [ID.DARK_PACT]: 680,
  [ID.NECROTIC_STAB]: 400,
  [ID.NECROTIC_BITE]: 640,
  [ID.NECROTIC_SLASH]: 360,
  [ID.LIFE_BLAST]: 920,
  [ID.DARK_PATH]: 880,
  [ID.LIFE_TRANSFER]: 2920,
  [ID.DHUUMFIRE_BLAST]: 920,
  [ID.DOOM]: 600,
  [ID.CORROSIVE_POISON_CLOUD]: 600,
  [ID.DEVOURING_DARKNESS]: 600,
  [ID.GRASPING_DEAD]: 880,
  [ID.BLOOD_CURSE]: 440,
  [ID.RENDING_CURSE]: 600,
  [ID.BLOOD_IS_POWER]: 880,
  [ID.PLAGUELANDS]: 920,
  [ID.PUTRID_CURSE]: 920,
  [ID.DEATHLY_SWARM]: 480,
  [ID.ENFEEBLING_BLOOD]: 840,
  [ID.DEATH_SPIRAL]: 720,
  [ID.ELIXIR_OF_PROMISE]: 680,
  [ID.ELIXIR_OF_ANGUISH]: 680,
  [ID.WEEPING_SHOTS]: 840,
  [ID.VICIOUS_SHOT]: 560,
  [ID.DARK_BARRAGE]: 920,
  [ID.VORACIOUS_ARC]: 840,
  [ID.DEVOURING_CUT]: 480,
  [ID.TAINTED_BOLTS]: 600,
  [ID.VILE_BLAST]: 600,
  [ID.ADDLE]: 360,
  [ID.EXTIRPATE]: 840,
  [ID.DARK_SLASH]: 600,
  [ID.ISOLATE]: 480,
  [ID.PERFORATE]: 840,
  [ID.HUNGERING_MAELSTROM]: 640,
  [ID.GORMANDIZE]: 440,
  [ID.DEVOURING_VISAGE]: 680,
  [ID.CONSUME]: 520,
  [ID.DEADLY_SLICE]: 520,
  [ID.SINISTER_STAB]: 560,
  [ID.ELIXIR_OF_RISK]: 540,
  [ID.LOCUST_SWARM]: 440,
  [ID.VITAL_DRAW]: 800,
  [ID.WAIL_OF_DOOM]: 1000,
  [ID.ELIXIR_OF_AMBITION]: 680,
  [ID.WELL_OF_DARKNESS]: 480,
  [ID.WELL_OF_SUFFERING]: 480,
  [ID.NIGHTFALL]: 480,
  [ID.GRASPING_DARKNESS]: 520,
  [ID.LIFE_REND]: 400,
  [ID.SOUL_SPIRAL]: 2160,
  [ID.LIFE_SLASH]: 600,
  [ID.LIFE_REAP]: 560,
  [ID.GRAVEDIGGER]: 1080,
  [ID.DUSK_STRIKE]: 480,
  [ID.FADING_TWILIGHT]: 640,
  [ID.CHILLING_SCYTHE]: 920,
  [ID.DEATHS_CHARGE]: 1200,
  [ID.GHASTLY_CLAWS]: 1440,
  [ID.RENDING_CLAWS]: 620,
  [ID.REAPERS_MARK]: 520,
  [ID.CHILLBLAINS]: 480,
  [ID.MARK_OF_BLOOD]: 480,
  [ID.EXECUTIONERS_SCYTHE]: 1320,
  [ID.NECROTIC_GRASP]: 880,
  [ID.PUTRID_MARK]: 480,
  [ID.TERRIFY]: 320,
  [ID.SUFFER]: 0,
  [ID.SIGNET_OF_SPITE]: 880,
  [ID.SPINAL_SHIVERS]: 800,
  [ID.MANIFEST_SAND_SHADE]: 480,
  [ID.HARROWING_WAVE]: 440,
  [ID.OPPRESSIVE_COLLAPSE]: 600,
  [ID.SOUL_GRASP]: 520,
  [ID.SIGNET_OF_VAMPIRISM]: 880,
  [ID.SPECTRAL_GRASP]: 600,
  [ID.FEAST_OF_CORRUPTION]: 600,
});

export const NECROMANCER_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(
    Object.entries(NECROMANCER_BASE_SKILL_MECHANICS).map(
      ([skillId, mechanics]) => {
        const quicknessCastTimeMs =
          NECROMANCER_QUICKNESS_CAST_TIMES_MS[skillId];
        const shroudSkillWeapon = [
          "death",
          "reaper",
          "harbinger",
        ].includes(mechanics.shroud)
          ? "Hammer"
          : null;
        if (quicknessCastTimeMs == null && !shroudSkillWeapon) {
          return [skillId, mechanics];
        }
        return [
          skillId,
          Object.freeze({
            ...mechanics,
            ...(shroudSkillWeapon
              ? { skillWeapon: shroudSkillWeapon }
              : {}),
            ...(quicknessCastTimeMs == null
              ? {}
              : {
                  castTimeMs: quicknessCastTimeMs * 1.5,
                  quicknessCastTimeMs,
                }),
          }),
        ];
      },
    ),
  ),
);

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
