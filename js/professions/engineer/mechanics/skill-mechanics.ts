/**
 * Explicit simulator mechanics keyed by stable GW2 skill ID.
 *
 * This file is authoritative for coefficients, packets, timing, cooldowns,
 * resource costs, and state requirements.
 */

import {
  ENGINEER_INTERNAL_IDS as INTERNAL,
  ENGINEER_SKILL_IDS as ID,
} from "../data/ids.js";
import type {
  Skill,
  SkillFragment,
} from "../../../platform/engine/types.js";

export const ENGINEER_SKILL_MECHANICS: Readonly<
  Record<string, SkillFragment>
> = Object.freeze({
  [ID.MED_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Med Kit",
  },
  [ID.GRENADE_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Grenade Kit",
  },
  [ID.POISON_GRENADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 680,
    "cooldown": 20,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 400, "coefficient": 0.75 },
          { "atMs": 440, "coefficient": 0.75 },
          { "atMs": 440, "coefficient": 0.75 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Poison Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 400, "condition": "Poisoned", "stacks": 3, "duration": 8 },
          { "atMs": 440, "condition": "Poisoned", "stacks": 3, "duration": 8 },
          { "atMs": 440, "condition": "Poisoned", "stacks": 3, "duration": 8 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "kit": "Grenade Kit",
  },
  [ID.SHRAPNEL_GRENADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 680,
    "cooldown": 5,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 400, "coefficient": 0.63 },
          { "atMs": 440, "coefficient": 0.63 },
          { "atMs": 440, "coefficient": 0.63 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Shrapnel Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 400, "condition": "Bleeding", "stacks": 1, "duration": 7 },
          { "atMs": 440, "condition": "Bleeding", "stacks": 1, "duration": 7 },
          { "atMs": 440, "condition": "Bleeding", "stacks": 1, "duration": 7 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "kit": "Grenade Kit",
  },
  [ID.FLASH_GRENADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.30000000000000004,
        "hits": 3,
        "atMs": 166.66666666666666,
        "intervalMs": 166.66666666666666,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Flash Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "blind",
        "actorType": "player",
        "metadata": {
          "duration": 5
        }
      }
    ],
    "kit": "Grenade Kit",
  },
  [ID.FREEZE_GRENADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 680,
    "cooldown": 20,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 400, "coefficient": 0.75 },
          { "atMs": 440, "coefficient": 0.75 },
          { "atMs": 440, "coefficient": 0.75 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Freeze Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 400, "condition": "Chilled", "stacks": 1, "duration": 2 },
          { "atMs": 440, "condition": "Chilled", "stacks": 1, "duration": 2 },
          { "atMs": 440, "condition": "Chilled", "stacks": 1, "duration": 2 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "kit": "Grenade Kit",
  },
  [ID.GRENADE_BARRAGE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 680,
    "cooldown": 25,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 6,
        "atMs": 83,
        "intervalMs": 83,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Grenade Barrage",
        "weapon": "Profession mechanic",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      }
    ],
    "toolbeltParentName": "Grenade Kit",
  },
  [ID.PERSONAL_BATTERING_RAM]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 5,
    "ammo": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Personal Battering Ram",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 450
        }
      }
    ],
  },
  [ID.BOMB_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Bomb Kit",
  },
  [ID.BIG_OL_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 600,
    "cooldown": 20,
    "finisherType": "Blast",
    "finisherValue": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "atMs": 2760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Big Ol' Bomb",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "atMs": 2760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "controlKind": "knockdown",
          "duration": 3
        }
      }
    ],
    "kit": "Bomb Kit",
  },
  [ID.JUMP_SHOT_ID_5817]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 18,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Leap Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1,
        "name": "Landing Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 7,
        "actorType": "player"
      }
    ],
  },
  [ID.RIFLE_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_RIFLE_TURRET,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.75,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 2000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Rifle Turret",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      }
    ],
  },
  [ID.ELIXIR_B]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
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
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 10,
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
  [ID.GALVANIC_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 600,
    "cooldown": 16,
    "finisherType": "Blast",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "atMs": 760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Galvanic Bomb",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 6,
        "duration": 8,
        "actorType": "player",
        "atMs": 760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "actorType": "player",
        "atMs": 760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "controlKind": "daze",
          "duration": 1
        }
      }
    ],
    "kit": "Bomb Kit",
  },
  [ID.FIRE_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 600,
    "cooldown": 8,
    "comboField": "Fire",
    "duration": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 4,
        "atMs": 760,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Fire Bomb",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 5,
        "actorType": "player",
        "atMs": 760,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "applications": 3,
        "atMs": 1760,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "actorType": "player",
        "persistsAfterInterrupt": true
      }
    ],
    "kit": "Bomb Kit",
  },
  [ID.SMOKE_BOMB_ENGINEER_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Bomb Kit",
  },
  [ID.SLICK_SHOES]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [
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
  [ID.FRAGMENTATION_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 0,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Fragmentation Shot",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
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
  [ID.POISON_DART_VOLLEY]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 840,
    "cooldown": 8,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 5,
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Poison Dart Volley",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 250, "condition": "Poisoned", "stacks": 1, "duration": 7 },
          { "atMs": 500, "condition": "Poisoned", "stacks": 1, "duration": 7 },
          { "atMs": 750, "condition": "Poisoned", "stacks": 1, "duration": 7 },
          { "atMs": 1000, "condition": "Poisoned", "stacks": 1, "duration": 7 },
          { "atMs": 1250, "condition": "Poisoned", "stacks": 1, "duration": 7 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "actorType": "player"
      }
    ],
  },
  [ID.STATIC_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 320,
    "cooldown": 12,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Static Shot",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.GLUE_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 560,
    "cooldown": 20,
    "duration": 5,
    "finisherType": "Blast",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Glue Shot",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 0, "condition": "Crippled", "stacks": 1, "duration": 2 },
          { "atMs": 1000, "condition": "Crippled", "stacks": 1, "duration": 2 },
          { "atMs": 2000, "condition": "Crippled", "stacks": 1, "duration": 2 },
          { "atMs": 3000, "condition": "Crippled", "stacks": 1, "duration": 2 }
        ],
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
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
  [ID.BLOWTORCH]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 560,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Maximum Damage",
        "persistsAfterInterrupt": true,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 4.5,
        "persistsAfterInterrupt": true,
        "actorType": "player"
      }
    ],
  },
  [ID.ELIXIR_X]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 75,
    "effects": [],
  },
  [ID.ELIXIR_H]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 2,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 4,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 4,
        "stacks": 1
      }
    ],
  },
  [ID.FLAME_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_FLAME_TURRET,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 3000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Flame Turret",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "actorType": "summon"
      }
    ],
  },
  [ID.NET_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_NET_TURRET,
    "castTimeMs": 500,
    "cooldown": 30,
    "effects": [],
  },
  [ID.THUMPER_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_THUMPER_TURRET,
    "castTimeMs": 500,
    "cooldown": 40,
    "effects": [
      {
        "type": "strike",
        "coefficient": 5,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 3000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Thumper Turret",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 3,
        "actorType": "summon"
      }
    ],
  },
  [ID.BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "atMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Bomb",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      }
    ],
    "kit": "Bomb Kit",
  },
  [ID.HEALING_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_HEALING_TURRET,
    "castTimeMs": 750,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.ELIXIR_C]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
  },
  [ID.ELIXIR_S]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [],
  },
  [ID.ELIXIR_U]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 6,
        "stacks": 2
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 6,
        "stacks": 1
      }
    ],
  },
  [ID.UTILITY_GOGGLES]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "resistance",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 4,
        "stacks": 1
      }
    ],
  },
  [ID.TOSS_ELIXIR_R]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 90,
    "effects": [],
    "toolbeltParentName": "Elixir R",
  },
  [ID.SUPPLY_CRATE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 75,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Supply Crate",
        "actorType": "summon"
      },
      {
        "type": "control",
        "actorType": "summon",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      }
    ],
  },
  [ID.AUTOMATIC_FIRE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Automatic Fire",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.GRENADE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 680,
    "cooldown": 0,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 400, "coefficient": 0.33 },
          { "atMs": 440, "coefficient": 0.33 },
          { "atMs": 440, "coefficient": 0.33 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      }
    ],
    "kit": "Grenade Kit",
  },
  [ID.THUMP]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Thump",
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
  [ID.ELECTRIFIED_NET]: {
    "implemented": true,
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Electrified Net",
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
  [ID.SMOKE_SCREEN]: {
    "implemented": true,
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.TOOL_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Tool Kit",
  },
  [ID.PRY_BAR]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Pry Bar",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 5,
        "duration": 5,
        "actorType": "player"
      }
    ],
    "kit": "Tool Kit",
  },
  [ID.ROCKET_BOOTS]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 2,
    "ammo": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Rocket Boots",
        "actorType": "player"
      }
    ],
  },
  [ID.ROCKET_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE_ROCKET_TURRET,
    "castTimeMs": 500,
    "cooldown": 40,
    "effects": [
      {
        "type": "strike",
        "coefficient": 11.25,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 4000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Rocket Turret",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      }
    ],
  },
  [ID.EXPLOSIVE_ROCKETS]: {
    "implemented": true,
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.75,
        "hits": 1,
        "name": "Explosive Rockets",
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
  [ID.FLAMETHROWER]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Flamethrower",
  },
  [ID.FLAME_JET]: {
    "implemented": true,
    "castTimeMs": 2570,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 10,
        "atMs": 257,
        "intervalMs": 257,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Flame Jet",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
    "kit": "Flamethrower",
  },
  [ID.NAPALM]: {
    "implemented": true,
    "castTimeMs": 2250,
    "quicknessCastTimeMs": 1760,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 5,
        "hits": 10,
        "atMs": 225,
        "intervalMs": 225,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Napalm",
        "actorType": "player"
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 225, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 450, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 675, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 900, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 1125, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 1350, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 1575, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 1800, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 2025, "condition": "Burning", "stacks": 1, "duration": 3.25 },
          { "atMs": 2250, "condition": "Burning", "stacks": 1, "duration": 3.25 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "actorType": "player"
      }
    ],
    "kit": "Flamethrower",
  },
  [ID.AIR_BLAST]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 360,
    "cooldown": 15,
    "effects": [
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockback",
          "duration": 400
        }
      }
    ],
    "kit": "Flamethrower",
  },
  [ID.FLAME_BLAST]: {
    "implemented": true,
    "castTimeMs": 1170,
    "quicknessCastTimeMs": 800,
    "measuredCancelMs": 480,
    "cooldown": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.3,
        "hits": 1,
        "name": "Flame Blast",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        },
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 6,
        "actorType": "player",
        "persistsAfterInterrupt": true
      }
    ],
    "kit": "Flamethrower",
  },
  [ID.ELIXIR_GUN]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Elixir Gun",
  },
  [ID.TRANQUILIZER_DART]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Tranquilizer Dart",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
    "kit": "Elixir Gun",
  },
  [ID.GLOB_SHOT]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 8,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Glob Shot",
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
        "type": "boon",
        "boon": "swiftness",
        "duration": 3,
        "stacks": 1
      }
    ],
    "kit": "Elixir Gun",
  },
  [ID.ACID_BOMB]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.85,
        "hits": 1,
        "name": "Acid Bomb — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.35,
        "hits": 1,
        "name": "Initial Damage",
        "actorType": "player"
      }
    ],
    "kit": "Elixir Gun",
  },
  [ID.SUPER_ELIXIR]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 16,
    "effects": [],
    "kit": "Elixir Gun",
  },
  [ID.DETONATE_RIFLE_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Rifle Turret",
    "castTimeMs": 0,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Rifle Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_THUMPER_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Thumper Turret",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Thumper Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_HEALING_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Healing Turret",
    "castTimeMs": 0,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Healing Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.FUMIGATE]: {
    "implemented": true,
    "castTimeMs": 2250,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 5,
        "atMs": 450,
        "intervalMs": 450,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Fumigate",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 5,
        "duration": 2,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 5,
        "duration": 6,
        "actorType": "player"
      }
    ],
    "kit": "Elixir Gun",
  },
  [ID.HEALING_MIST]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 10,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Elixir Gun",
  },
  [ID.TOSS_ELIXIR_B]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "Stability",
        "duration": 4,
        "stacks": 3
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
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 10,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Elixir B",
  },
  [ID.ELIXIR_R]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "effects": [],
  },
  [ID.TOSS_ELIXIR_C]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 16,
    "effects": [],
    "toolbeltParentName": "Elixir C",
  },
  [ID.TOSS_ELIXIR_U]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [],
    "toolbeltParentName": "Elixir U",
  },
  [ID.TOSS_ELIXIR_S]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 45,
    "effects": [],
    "toolbeltParentName": "Elixir S",
  },
  [ID.SUPERSPEED_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
    "toolbeltParentName": "Slick Shoes",
  },
  [ID.TOSS_ELIXIR_H]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 2,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 4,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 4,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Elixir H",
    "mechanicSlot": 1,
  },
  [ID.CLEANSING_BURST]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 5,
        "stacks": 1
      }
    ],
  },
  [ID.LAUNCH_PERSONAL_BATTERING_RAM]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Launch Personal Battering Ram",
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
    "toolbeltParentName": "Personal Battering Ram",
  },
  [ID.ROCKET_KICK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Rocket Kick",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 8,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Rocket Boots",
  },
  [ID.DETONATE_NET_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Net Turret",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Net Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_FLAME_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Flame Turret",
    "castTimeMs": 0,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Flame Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.SMACK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Smack",
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
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "kit": "Tool Kit",
  },
  [ID.WHACK]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Whack",
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
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "kit": "Tool Kit",
  },
  [ID.THWACK]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Thwack",
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
    "kit": "Tool Kit",
  },
  [ID.BOX_OF_NAILS]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 10,
    "effects": [
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 2,
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
    "kit": "Tool Kit",
  },
  [ID.MAGNET]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 15,
    "effects": [],
    "kit": "Tool Kit",
  },
  [ID.GEAR_SHIELD]: {
    "implemented": true,
    "castTimeMs": 2000,
    "cooldown": 15,
    "effects": [],
    "kit": "Tool Kit",
  },
  [ID.THROW_WRENCH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Throw Wrench",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
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
    "toolbeltParentName": "Tool Kit",
  },
  [ID.RIFLE_BURST]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 835,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.6,
        "hits": 1,
        "atMs": 318,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Rifle Burst",
        "actorType": "player",
        "metadata": {
          "projectile": true,
          "finisherType": "Projectile",
          "finisherValue": 0.2
        }
      },
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "atMs": 602,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Rifle Burst Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      }
    ],
  },
  [ID.NET_SHOT]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 570,
    "cooldown": 9,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "atMs": 518,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Net Shot",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 8,
        "duration": 8,
        "atMs": 518,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 4,
        "atMs": 518,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
  },
  [ID.JUMP_SHOT]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 1000,
    "cooldown": 18,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "atMs": 117,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Leap Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1,
        "atMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Landing Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 7,
        "atMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
  },
  [ID.LESSER_GRENADE_BARRAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 6,
        "name": "Lesser Grenade Barrage",
        "actorType": "player"
      }
    ],
  },
  [ID.MAGNETIC_SHIELD]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "castTimeMs": 3000,
    "cooldown": 20,
    "effects": [],
  },
  [ID.STATIC_SHIELD]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "castTimeMs": 2500,
    "cooldown": 24,
    "effects": [
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
  [ID.THROW_SHIELD]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Static Shield",
    "castTimeMs": 750,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Throw Shield",
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
  [ID.TOSS_ELIXIR_C_ID_6077]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 16,
    "effects": [],
    "toolbeltParentName": "Elixir C",
  },
  [ID.DETONATE_ELIXIR_C]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir C",
  },
  [ID.DETONATE_ELIXIR_B]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir B",
  },
  [ID.DETONATE_ELIXIR_S]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir S",
  },
  [ID.DETONATE_ELIXIR_R]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir R",
  },
  [ID.DETONATE_ELIXIR_U]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 3,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Elixir U",
  },
  [ID.TOSS_ELIXIR_U_ID_6089]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [],
    "toolbeltParentName": "Elixir U",
  },
  [ID.TOSS_ELIXIR_S_ID_6090]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 45,
    "effects": [],
    "toolbeltParentName": "Elixir S",
  },
  [ID.TOSS_ELIXIR_R_ID_6091]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 90,
    "effects": [],
    "toolbeltParentName": "Elixir R",
  },
  [ID.TOSS_ELIXIR_B_ID_6092]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "Stability",
        "duration": 4,
        "stacks": 3
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
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 10,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Elixir B",
  },
  [ID.HARPOON_TURRET]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.25,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 2000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Harpoon Turret",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      }
    ],
  },
  [ID.DETONATE_HARPOON_TURRET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Harpoon Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.AUTOMATIC_FIRE_HARPOON_TURRET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Automatic Fire (Harpoon Turret)",
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
  [ID.SUPER_ELIXIR_CHAIN_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Elixir Gun",
  },
  [ID.STOW_MED_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Med Kit",
  },
  [ID.STOW_GRENADE_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Grenade Kit",
  },
  [ID.STOW_BOMB_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Bomb Kit",
  },
  [ID.STOW_TOOL_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Tool Kit",
  },
  [ID.STOW_FLAMETHROWER]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Flamethrower",
  },
  [ID.STOW_ELIXIR_GUN]: {
    "implemented": true,
    "handlerId": "engineer.kit-stow",
    "paletteFlip": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kit": "Elixir Gun",
  },
  [ID.DETONATE_ELIXIR_H]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir H",
  },
  [ID.MAGNETIC_INVERSION]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Magnetic Shield",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.25,
        "hits": 1,
        "name": "Magnetic Inversion",
        "actorType": "player"
      }
    ],
  },
  [ID.DETONATE_ROCKET_TURRET]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Rocket Turret",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Rocket Turret",
        "actorType": "player"
      }
    ],
  },
  [ID.BLUNDERBUSS]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 400,
    "cooldown": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.2,
        "hits": 1,
        "atMs": 368,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Maximum Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 9,
        "atMs": 368,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 5,
        "atMs": 368,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ],
  },
  [ID.OVERCHARGED_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 400,
    "cooldown": 14,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "atMs": 451,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Overcharged Shot",
        "actorType": "player",
        "metadata": {
          "projectile": true
        },
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 450
        }
      }
    ],
  },
  [ID.SMOKE_VENT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 15,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Flamethrower",
  },
  [ID.THROW_MINE]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "paletteFlipSkillId": ID.DETONATE,
    "castTimeMs": 500,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Throw Mine",
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
  [ID.DETONATE]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "flipParentName": "Throw Mine",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Detonate (engineer skill)",
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
  [ID.DEPLOY_MINE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.65,
        "hits": 1,
        "name": "Deploy Mine",
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
  [ID.MINE_FIELD]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 17,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.77,
        "hits": 1,
        "name": "Damage per Mine",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Throw Mine",
  },
  [ID.DETONATE_MINE_FIELD]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.77,
        "hits": 1,
        "name": "Damage per Mine",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Throw Mine",
  },
  [ID.REGENERATING_MIST]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 18,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 2
      }
    ],
    "toolbeltParentName": "Healing Turret",
    "mechanicSlot": 1,
  },
  [ID.ROCKET]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Rocket",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Rocket Turret",
  },
  [ID.SURPRISE_SHOT_ENGINEER_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 8,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Surprise Shot (engineer skill)",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Rifle Turret",
  },
  [ID.NET_ATTACK]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 38,
    "effects": [],
    "toolbeltParentName": "Net Turret",
  },
  [ID.RUMBLE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 38,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Rumble",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 1,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Thumper Turret",
  },
  [ID.THROW_NAPALM]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.0999999999999996,
        "hits": 3,
        "atMs": 167,
        "intervalMs": 167,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Throw Napalm",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Flame Turret",
  },
  [ID.HARPOON_ENGINEER_SKILL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 8,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Harpoon (engineer skill)",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Harpoon Turret",
  },
  [ID.WITHERING_PLAGUE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.PLAGUE_OF_DARKNESS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "condition",
        "condition": "Torment",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
  },
  [ID.PLAGUE_OF_PESTILENCE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 2.5,
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
  [ID.CONFUSING_SPEECH]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 45,
    "effects": [
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Technobabble",
  },
  [ID.PAIN_TRANSFERENCE]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 45,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Pain Transference",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Pain Inverter",
  },
  [ID.VENT_RADIATION]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 45,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 9,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Radiation Field",
  },
  [ID.INVIGORATING_ROAR]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 50,
    "effects": [
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 10,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Battle Roar",
  },
  [ID.BOOBY_TRAP_CHARR_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 45,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Booby Trap (charr skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 3,
        "duration": 10,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Shrapnel Mine",
  },
  [ID.HIDDEN_PISTOLS]: {
    "implemented": true,
    "castTimeMs": 1750,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Hidden Pistols",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Hidden Pistol",
  },
  [ID.BLESSING_OF_DWAYNA]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 40,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Prayer to Dwayna",
    "mechanicSlot": 1,
  },
  [ID.BLESSING_OF_KORMIR]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 30,
    "effects": [],
    "toolbeltParentName": "Prayer to Kormir",
  },
  [ID.BLESSING_OF_LYSSA]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 35,
    "effects": [],
    "toolbeltParentName": "Prayer to Lyssa",
  },
  [ID.EAT_WURM_EGG]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 30,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 6,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Call Wurm",
  },
  [ID.EAT_OWL_EGG]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 30,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
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
    "toolbeltParentName": "Call Owl",
  },
  [ID.THROW_VINE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 45,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Throw Vine",
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
    "toolbeltParentName": "Seed Turret",
  },
  [ID.VINE_SHIELD]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 45,
    "effects": [],
    "toolbeltParentName": "Grasping Vines",
  },
  [ID.LEAFY_BANDAGE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 40,
    "effects": [],
    "toolbeltParentName": "Healing Seed",
    "mechanicSlot": 1,
  },
  [ID.LESSER_ELIXIR_B]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 24,
    "effects": [
      {
        "type": "boon",
        "boon": "fury",
        "duration": 8,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "resolution",
        "duration": 8,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 8,
        "stacks": 1
      }
    ],
  },
  [ID.ALLY_WARD]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.STATIC_DISCHARGE_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1,
        "name": "Static Discharge (trait skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.PLAGUE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 105,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.39,
        "hits": 1,
        "name": "Plague",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 2,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.SNOWMAN_TURRET_SKILL]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 20,
    "effects": [],
  },
  [ID.DETONATE_SNOWMAN_TURRET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.DROP_MINE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Drop Mine",
        "actorType": "player"
      }
    ],
  },
  [ID.MAGNETIC_BOMB_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 300
        }
      }
    ],
  },
  [ID.SUPERSPEED_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.FIRE_SHIELD_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 10,
        "stacks": 1
      }
    ],
  },
  [ID.MAGNETIC_AURA_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.GLUE_TRAIL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
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
  [ID.A_E_D]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 24,
    "effects": [],
  },
  [ID.STATIC_SHOCK]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 680,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Static Shock",
        "weapon": "Profession mechanic",
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
    "toolbeltParentName": "A.E.D.",
    "mechanicSlot": 1,
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.95,
        "hits": 1,
        "name": "Bunker Down (trait skill)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 6,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.OVERFUELED_FLAME_JET]: {
    "implemented": true,
    "castTimeMs": 2250,
    "cooldown": 1,
    "effects": [],
  },
  [ID.RECONSTRUCTION_FIELD]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 2,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Medic Gyro",
    "mechanicSlot": 1,
  },
  [ID.DETONATE_SUPPLY_CRATE_TURRETS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Detonate Supply Crate Turrets",
        "actorType": "player"
      }
    ],
  },
  [ID.ROCKET_BOOTS_ID_29522]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Rocket Boots",
        "actorType": "player"
      }
    ],
  },
  [ID.BANDAGE_BLAST]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 8,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
    "kit": "Med Kit",
  },
  [ID.UTILITY_GOGGLES_ID_29591]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "resistance",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 4,
        "stacks": 1
      }
    ],
  },
  [ID.INVISIBLE_ANALYSIS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 5,
        "stacks": 1
      }
    ],
  },
  [ID.BYPASS_COATING]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
    "toolbeltParentName": "Blast Gyro Tag",
  },
  [ID.CLEANSING_PULSE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "Regeneration",
        "duration": 4,
        "stacks": 1
      }
    ],
  },
  [ID.MED_PACK_DROP]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 50,
    "effects": [],
    "toolbeltParentName": "Supply Crate",
    "mechanicSlot": 5,
  },
  [ID.DETONATE_ELIXIR_X]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "toolbeltParentName": "Elixir X (underwater)",
  },
  [ID.PURGE_GYRO]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
  },
  [ID.BANDAGE_SELF]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 17,
    "effects": [],
    "toolbeltParentName": "Med Kit",
    "mechanicSlot": 1,
  },
  [ID.NEGATIVE_BASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Negative Bash",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.LESSER_UTILITY_GOGGLES]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "boon",
        "boon": "resistance",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.SHOCK_SHIELD]: {
    "implemented": true,
    "castTimeMs": 1750,
    "cooldown": 18,
    "blockDuration": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 5,
        "atMs": 350,
        "intervalMs": 350,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Shock Shield",
        "actorType": "player"
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
  [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Aim-Assisted Rocket (trait skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.DROP_GUNK]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Drop Gunk",
        "actorType": "player"
      }
    ],
  },
  [ID.SHREDDER_GYRO]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 57.599999999999994,
        "hits": 12,
        "atMs": 42,
        "intervalMs": 42,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Shredder Gyro",
        "actorType": "effect"
      }
    ],
  },
  [ID.PERSONAL_BATTERING_RAM_ID_29991]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 5,
    "ammo": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Personal Battering Ram",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 450
        }
      }
    ],
  },
  [ID.DEFENSE_FIELD]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "boon",
        "boon": "stability",
        "duration": 6,
        "stacks": 3
      }
    ],
    "toolbeltParentName": "Bulwark Gyro",
  },
  [ID.ELIXIR_SHELL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 24,
    "effects": [],
    "kit": "Elite Mortar Kit",
  },
  [ID.ELECTRO_WHIRL]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 6,
    "finisherType": "Whirl",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 2,
        "atMs": 500,
        "intervalMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Electro-whirl",
        "actorType": "player"
      }
    ],
  },
  [ID.BULWARK_GYRO]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.FLASH_SHELL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Flash Shell",
        "actorType": "player"
      },
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
    "kit": "Elite Mortar Kit",
  },
  [ID.BANDAGE_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.FLASHBANG]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.05,
        "hits": 1,
        "name": "Flashbang",
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
    "toolbeltParentName": "Utility Goggles",
  },
  [ID.OVERCHARGE_SUPPLY_CRATE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": [],
  },
  [ID.CHEMICAL_FIELD]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 20,
    "effects": [
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Purge Gyro",
  },
  [ID.ENDOTHERMIC_SHELL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Endothermic Shell",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 1,
        "actorType": "player"
      }
    ],
    "kit": "Elite Mortar Kit",
  },
  [ID.THROW_MINE_ID_30337]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Throw Mine",
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
  [ID.MEDIC_GYRO]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [],
  },
  [ID.MORTAR_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Mortar Shot",
        "actorType": "player"
      }
    ],
    "kit": "Elite Mortar Kit",
  },
  [ID.EQUALIZING_BLOW]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1,
        "name": "Equalizing Blow",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 3,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 3
      }
    ],
  },
  [ID.POSITIVE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 1,
        "name": "Positive Strike",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1
      }
    ],
  },
  [ID.MED_BLASTER]: {
    "implemented": true,
    "castTimeMs": 1250,
    "cooldown": 0,
    "effects": [],
    "kit": "Med Kit",
  },
  [ID.ORBITAL_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 40,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.33,
        "hits": 1,
        "name": "Orbital Strike",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Elite Mortar Kit",
    "mechanicSlot": 5,
  },
  [ID.ROCKET_CHARGE]: {
    "implemented": true,
    "castTimeMs": 1750,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 3,
        "atMs": 583,
        "intervalMs": 583,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Rocket Charge",
        "actorType": "player"
      }
    ],
  },
  [ID.LONG_FUSED_POWDER_PACK]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Long-Fused Powder Pack",
        "actorType": "player"
      }
    ],
  },
  [ID.THUNDERCLAP]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "comboField": "Lightning",
    "duration": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 5,
        "atMs": 1750,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Thunderclap",
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "applications": 5,
        "atMs": 1750,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "atMs": 750,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "metadata": {
          "controlKind": "stun",
          "duration": 1
        }
      }
    ],
  },
  [ID.TOSS_ELIXIR_X]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 60,
    "effects": [],
    "toolbeltParentName": "Elixir X",
    "mechanicSlot": 5,
  },
  [ID.ELITE_MORTAR_KIT]: {
    "implemented": true,
    "handlerId": "engineer.kit-equip",
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
    "kitName": "Elite Mortar Kit",
  },
  [ID.SNEAK_GYRO]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 45,
    "effects": [],
  },
  [ID.SLICK_SHOES_ID_30828]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [
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
  [ID.A_E_D_ID_30881]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 24,
    "effects": [],
  },
  [ID.POISON_GAS_SHELL]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Poison Gas Shell",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "kit": "Elite Mortar Kit",
  },
  [ID.DEPLOY_MINE_ID_30893]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.65,
        "hits": 1,
        "name": "Deploy Mine",
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
  [ID.SPARE_CAPACITOR]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 24,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.8,
        "hits": 4,
        "atMs": 125,
        "intervalMs": 125,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Spare Capacitor",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Shredder Gyro",
  },
  [ID.BLAST_GYRO]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 11,
        "hits": 4,
        "atMs": 63,
        "intervalMs": 63,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Blast Gyro",
        "actorType": "effect"
      },
      {
        "type": "control",
        "actorType": "effect",
        "metadata": {
          "controlKind": "stun",
          "duration": 3
        }
      },
      {
        "type": "boon",
        "boon": "Might",
        "duration": 15,
        "stacks": 2
      }
    ],
  },
  [ID.RADIANT_ARC]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 840,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Radiant Arc",
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
        "type": "custom",
        "eventType": "engineer.radiant-arc-quickness",
        "event": {
          "name": "Radiant Arc — quickness"
        },
        "actorType": "player"
      }
    ],
  },
  [ID.THROW_JUNK_DOPPELGANGER]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0.25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1,
        "name": "Throw Junk (Doppelganger)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 3,
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
  [ID.COOLANT_BLAST]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "effects": [
      {
        "type": "condition",
        "condition": "Chilled",
        "stacks": 1,
        "duration": 4,
        "actorType": "player"
      }
    ],
  },
  [ID.LAUNCH_WALL]: {
    "implemented": true,
    "handlerId": "engineer.consume-flip",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 0.5,
    "flipParentName": "Photon Wall",
    "effects": [
      {
        "type": "custom",
        "eventType": "engineer.launch-wall",
        "atMs": 0,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "event": {
          "name": "Launch Wall"
        },
        "actorType": "player"
      }
    ],
  },
  [ID.DEACTIVATE_PHOTON_FORGE]: {
    "implemented": true,
    "handlerId": "engineer.photon-forge-exit",
    "castTimeMs": 0,
    "cooldown": 6,
    "heatGain": 15,
    "effects": [],
    "toolbeltParentName": "Photon Projector",
    "mechanicSlot": 5,
  },
  [ID.SPECTRUM_SHIELD]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "stability",
        "duration": 4,
        "stacks": 6
      }
    ],
  },
  [ID.ORBITAL_COMMAND_STRIKE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.92,
        "hits": 1,
        "name": "Orbital Command Strike",
        "actorType": "player"
      }
    ],
  },
  [ID.FLASH_CUTTER_STORM]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 560,
    "cooldown": 0,
    "heatGain": 3,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 2,
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Flash Cutter—Storm",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      }
    ],
    "forgeSkill": true
  },
  [ID.PRISMATIC_SINGULARITY]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1,
        "name": "Pull Damage",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Explosion Damage",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "pull",
          "duration": 240
        }
      }
    ],
    "toolbeltParentName": "Hard Light Arena",
  },
  [ID.PRIME_LIGHT_BEAM]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 1160,
    "cooldown": 60,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Prime Light Beam — Packet 1",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "custom",
        "eventType": "engineer.prime-light-beam-field",
        "atMs": 0,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "event": {
          "name": "Prime Light Beam — field"
        },
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 240
        }
      }
    ],
  },
  [ID.BLADE_BURST]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Blade Burst",
        "weapon": "Profession mechanic",
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
    "toolbeltParentName": "Laser Disk",
  },
  [ID.BRIGHT_SLASH_STORM]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 520,
    "cooldown": 0,
    "heatGain": 3,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Bright Slash—Storm",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      }
    ],
    "forgeSkill": true
  },
  [ID.HOLOGRAPHIC_SHOCKWAVE]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 750,
    "cooldown": 15,
    "heatGain": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Holographic Shockwave",
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
    "forgeSkill": true
  },
  [ID.LASER_DISK]: {
    "implemented": true,
    "castTimeMs": 1500,
    "quicknessCastTimeMs": 960,
    "cooldown": 30,
    "effects": [
      {
        "type": "custom",
        "eventType": "engineer.laser-disk",
        "atMs": 0,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "event": {
          "name": "Laser Disk"
        },
        "actorType": "player"
      }
    ],
  },
  [ID.ENGAGE_PHOTON_FORGE]: {
    "implemented": true,
    "handlerId": "engineer.photon-forge-enter",
    "castTimeMs": 0,
    "cooldown": 1,
    "heatGain": 2,
    "effects": [],
    "toolbeltParentName": "Photon Projector",
    "mechanicSlot": 5,
  },
  [ID.HOLO_LEAP]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 750,
    "cooldown": 2,
    "heatGain": 7,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Holo Leap",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "swiftness",
        "duration": 3,
        "stacks": 1
      }
    ],
    "forgeSkill": true
  },
  [ID.FLASH_SPARK]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "blind",
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Spectrum Shield",
  },
  [ID.SUN_EDGE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 440,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.88,
        "hits": 1,
        "name": "Sun Edge",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.VENT_EXHAUST]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 0,
    "cooldown": 0,
    "heatGain": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1,
        "name": "Vent Exhaust",
        "actorType": "player",
        "metadata": {
          "noCrit": true
        }
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.PHOTON_WALL]: {
    "implemented": true,
    "handlerId": "engineer.arm-flip",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 400,
    "cooldown": 25,
    "paletteFlipSkillId": ID.LAUNCH_WALL,
    "effects": [],
  },
  [ID.CAUTERIZE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "toolbeltParentName": "Coolant Blast",
    "mechanicSlot": 1,
  },
  [ID.OVERHEAT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.REFRACTION_CUTTER]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1,
        "atMs": 320,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Refraction Cutter — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "atMs": 360,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Refraction Cutter Blade",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "atMs": 360,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      },
      {
        "type": "custom",
        "eventType": "engineer.refraction-cutter-extra-blades",
        "atMs": 0,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "event": {
          "name": "Refraction Cutter extra blades"
        },
        "actorType": "player"
      }
    ],
  },
  [ID.LIGHT_STRIKE_STORM]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 360,
    "cooldown": 0,
    "heatGain": 3,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Light Strike—Storm",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      }
    ],
    "forgeSkill": true
  },
  [ID.HOLOFORGE_OVERHEATED]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.CORONA_BURST]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 480,
    "interruptCommitMs": 400,
    "cooldown": 6,
    "heatGain": 10,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 400,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Initial Damage",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 1800,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Explosion Damage",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 8,
        "duration": 8,
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 400, "condition": "Burning", "stacks": 2, "duration": 5 },
          { "atMs": 1800, "condition": "Burning", "stacks": 2, "duration": 5 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1,
        "atMs": 400,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1,
        "atMs": 760,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1,
        "atMs": 1120,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1,
        "atMs": 1480,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 1,
        "atMs": 1800,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true
      }
    ],
    "forgeSkill": true
  },
  [ID.LIGHT_STRIKE]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 360,
    "cooldown": 0,
    "heatGain": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Light Strike",
        "actorType": "player"
      }
    ],
    "forgeSkill": true
  },
  [ID.HARD_LIGHT_ARENA]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 35,
    "effects": [
      {
        "type": "boon",
        "boon": "fury",
        "duration": 2,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 2,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 2,
        "stacks": 1
      }
    ],
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.275,
        "hits": 1,
        "name": "Refraction Cutter Blade",
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
  [ID.DEACTIVATE_PHOTON_FORGE_HOT]: {
    "implemented": true,
    "handlerId": "engineer.photon-forge-exit",
    "castTimeMs": 0,
    "cooldown": 6,
    "heatGain": 15,
    "effects": [],
    "toolbeltParentName": "Photon Projector",
    "mechanicSlot": 5,
  },
  [ID.SUN_RIPPER]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 480,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.93,
        "hits": 1,
        "name": "Sun Ripper",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.CONTROLLED_ANALYSIS]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 10,
        "duration": 8,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 5,
        "stacks": 1
      }
    ],
  },
  [ID.PARTICLE_ACCELERATOR]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 8,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Particle Accelerator",
        "weapon": "Profession mechanic",
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
        "type": "boon",
        "boon": "swiftness",
        "duration": 3,
        "stacks": 1
      }
    ],
    "toolbeltParentName": "Photon Wall",
  },
  [ID.BRIGHT_SLASH]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 0,
    "heatGain": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Bright Slash",
        "actorType": "player"
      }
    ],
    "forgeSkill": true
  },
  [ID.PHOTON_BLITZ]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 1500,
    "quicknessCastTimeMs": 1320,
    "cooldown": 10,
    "heatGain": 16,
    "finisherType": "Projectile",
    "finisherValue": 0.2,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 240, "coefficient": 0.64 },
          { "atMs": 400, "coefficient": 0.64 },
          { "atMs": 480, "coefficient": 0.64 },
          { "atMs": 640, "coefficient": 0.64 },
          { "atMs": 720, "coefficient": 0.64 },
          { "atMs": 880, "coefficient": 0.64 },
          { "atMs": 960, "coefficient": 0.64 },
          { "atMs": 1120, "coefficient": 0.64 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Photon Blitz",
        "actorType": "player",
        "metadata": {
          "projectile": true
        }
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 240, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 400, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 480, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 640, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 720, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 880, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 960, "condition": "Burning", "stacks": 1, "duration": 3 },
          { "atMs": 1120, "condition": "Burning", "stacks": 1, "duration": 3 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "forgeSkill": true
  },
  [ID.FLASH_CUTTER]: {
    "implemented": true,
    "handlerId": "engineer.heat",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 0,
    "heatGain": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 2,
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Flash Cutter",
        "actorType": "player"
      }
    ],
    "forgeSkill": true
  },
  [ID.GLEAM_SABER]: {
    "implemented": true,
    "handlerId": "engineer.gleam-saber",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 720,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Gleam Saber",
        "actorType": "player"
      }
    ],
  },
  [ID.CLEANSING_FIELD]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [],
    "kit": "Med Kit",
  },
  [ID.VITAL_BURST]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
    "kit": "Med Kit",
  },
  [ID.LESSER_ELIXIR_C]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 10,
    "effects": [],
  },
  [ID.INFUSION_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 20,
    "effects": [
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
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 10,
        "stacks": 1
      }
    ],
    "kit": "Med Kit",
  },
  [ID.FUNCTION_GYRO]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Function Gyro (tool belt skill)",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 5,
  },
  [ID.FUNCTION_GYRO_TOOL_BELT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Function Gyro (tool belt skill)",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 5,
  },
  [ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0.25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1,
        "name": "Explosive Entrance (trait skill)",
        "actorType": "player"
      }
    ],
  },
  [ID.RECTIFIER_SIGNET]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 30,
    "effects": [],
  },
  [ID.CRASH_DOWN]: {
    "implemented": true,
    "handlerId": "engineer.mech-summon",
    "castTimeMs": 750,
    "cooldown": 50,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Crash Down",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "launch",
          "duration": 200
        }
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.MACE_SMASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Mace Smash (mechanist)",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 2,
        "duration": 5,
        "actorType": "summon"
      }
    ],
  },
  [ID.RECALL_MECH]: {
    "implemented": true,
    "handlerId": "engineer.mech-recall",
    "castTimeMs": 750,
    "cooldown": 10,
    "effects": [],
    "mechanicSlot": 4,
  },
  [ID.OVERCLOCK_SIGNET]: {
    "implemented": true,
    "handlerId": "engineer.overclock-signet",
    "castTimeMs": 0,
    "cooldown": 90,
    "effects": [],
  },
  [ID.SHIFT_SIGNET]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [],
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 14.399999999999999,
        "hits": 6,
        "atMs": 125,
        "intervalMs": 125,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Superconducting Signet",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 6,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 6,
        "duration": 3,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 6,
        "duration": 3,
        "actorType": "player"
      }
    ],
  },
  [ID.JADE_MORTAR]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.2,
        "hits": 1,
        "atMs": 601,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Jade Mortar",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 6,
        "atMs": 601,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "atMs": 601,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "actorType": "summon",
        "metadata": {
          "controlKind": "daze",
          "duration": 1
        }
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.BARRIER_BURST]: {
    "implemented": true,
    "castTimeMs": 3750,
    "cooldown": 30,
    "effects": [
      {
        "type": "boon",
        "boon": "might",
        "duration": 20,
        "stacks": 2
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 3,
        "stacks": 1
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.ENERGIZING_SLAM]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.85,
        "hits": 1,
        "name": "Energizing Slam",
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
        "condition": "Confusion",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "vigor",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "regeneration",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.AERIAL_SUPPORT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Aerial Support",
        "actorType": "player"
      }
    ],
  },
  [ID.MACE_BLAST]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1,
        "name": "Mace Blast",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 3,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.ROCKET_PUNCH_MECH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 5,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Rocket Punch (Mech)",
        "actorType": "summon",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 5,
        "actorType": "summon"
      },
      {
        "type": "control",
        "actorType": "summon",
        "metadata": {
          "controlKind": "defiance",
          "duration": 100
        }
      }
    ],
  },
  [ID.MACE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Mace Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 1,
        "duration": 5,
        "actorType": "player"
      }
    ],
  },
  [ID.SPARK_REVOLVER]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 717, "coefficient": 0.176 },
          { "atMs": 717, "coefficient": 0.176 },
          { "atMs": 834, "coefficient": 0.176 },
          { "atMs": 834, "coefficient": 0.176 },
          { "atMs": 1001, "coefficient": 0.176 },
          { "atMs": 1001, "coefficient": 0.176 },
          { "atMs": 1151, "coefficient": 0.176 },
          { "atMs": 1151, "coefficient": 0.176 },
          { "atMs": 1318, "coefficient": 0.176 },
          { "atMs": 1318, "coefficient": 0.176 },
          { "atMs": 1484, "coefficient": 0.176 },
          { "atMs": 1484, "coefficient": 0.176 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Spark Revolver",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      }
    ],
    "mechanicSlot": 1,
  },
  [ID.MECH_SUPPORT_DEPTH_CHARGES]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Mech Support: Depth Charges",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "actorType": "summon"
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.ROCKET_FIST_PROTOTYPE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 12,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Rocket Fist Prototype",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 5,
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
  [ID.SKY_CIRCUS]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 3,
        "name": "Missile Damage",
        "actorType": "summon"
      },
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Landing Damage",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 5,
        "actorType": "summon"
      },
      {
        "type": "control",
        "actorType": "summon",
        "metadata": {
          "controlKind": "knockdown",
          "duration": 232
        }
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.FORCE_SIGNET]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Force Signet",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "knockback",
          "duration": 240
        }
      }
    ],
  },
  [ID.BARRIER_SIGNET]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 30,
    "effects": [],
  },
  [ID.HEAVY_SMASH_MECH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.45,
        "hits": 1,
        "name": "Heavy Smash (Mech)",
        "actorType": "summon"
      }
    ],
  },
  [ID.JADE_ENERGY_SHOT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.TWIN_STRIKE_MECH]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 2,
        "atMs": 250,
        "intervalMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Twin Strike (Mech)",
        "actorType": "summon"
      }
    ],
  },
  [ID.CRISIS_ZONE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [
      {
        "type": "boon",
        "boon": "aegis",
        "duration": 3,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 6,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "alacrity",
        "duration": 6,
        "stacks": 1
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.HARD_STRIKE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.45,
        "hits": 1,
        "name": "Hard Strike",
        "actorType": "player"
      }
    ],
  },
  [ID.RECALL_MECH_ID_63300]: {
    "implemented": true,
    "handlerId": "engineer.mech-recall",
    "castTimeMs": 750,
    "cooldown": 10,
    "effects": [],
    "mechanicSlot": 4,
  },
  [ID.ROLLING_SMASH]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 1,
        "name": "Rolling Smash",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 4,
        "duration": 8,
        "actorType": "summon"
      }
    ],
    "mechanicSlot": 1,
  },
  [ID.CORE_REACTOR_SHOT]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "atMs": 684,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Core Reactor Shot",
        "actorType": "summon",
        "persistsAfterInterrupt": true
      },
      {
        "type": "control",
        "atMs": 684,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "actorType": "summon",
        "metadata": {
          "controlKind": "launch",
          "duration": 232
        }
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.JADE_ENERGY_SHOT_ID_63348]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.EXPLOSIVE_KNUCKLE]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Explosive Knuckle",
        "actorType": "summon",
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "condition",
        "condition": "Weakness",
        "stacks": 1,
        "duration": 5,
        "actorType": "summon"
      }
    ],
    "mechanicSlot": 1,
  },
  [ID.DISCHARGE_ARRAY]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 30,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 5,
        "atMs": 0,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Discharge Array",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Slow",
        "stacks": 1,
        "duration": 2,
        "applications": 5,
        "atMs": 0,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Confusion",
        "stacks": 2,
        "duration": 3,
        "applications": 5,
        "atMs": 0,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "applications": 5,
        "atMs": 0,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "summon"
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.JADE_BUSTER_CANNON]: {
    "implemented": true,
    "simulatorExcluded": true,
    "castTimeMs": 3250,
    "cooldown": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.75,
        "hits": 5,
        "atMs": 650,
        "intervalMs": 650,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Jade Buster Cannon",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 6,
        "applications": 5,
        "atMs": 650,
        "intervalMs": 650,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "actorType": "summon"
      }
    ],
    "toolbeltParentName": "Overclock Signet",
  },
  [ID.RIFLE_BURST_GRENADE]: {
    "implemented": true,
    "simulatorExcluded": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Rifle Burst Grenade",
        "actorType": "player",
        "metadata": {
          "damageKind": "explosion",
          "projectile": true
        }
      }
    ],
  },
  [ID.RADIANT_ARC_ID_69565]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 840,
    "cooldown": 14,
    "finisherType": "Leap",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Radiant Arc (non-holosmith)",
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
        "boon": "quickness",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.SUN_RIPPER_ID_69906]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 480,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.02,
        "hits": 1,
        "name": "Sun Ripper (non-holosmith)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.SUN_EDGE_ID_70514]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 440,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.96,
        "hits": 1,
        "name": "Sun Edge (non-holosmith)",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 10,
        "actorType": "player"
      }
    ],
  },
  [ID.GLEAM_SABER_ID_70771]: {
    "implemented": true,
    "handlerId": "engineer.gleam-saber",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 720,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.65,
        "hits": 1,
        "name": "Gleam Saber (non-holosmith)",
        "actorType": "player"
      }
    ],
  },
  [ID.REFRACTION_CUTTER_ID_71121]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1,
        "name": "Refraction Cutter (non-holosmith) — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 2,
        "atMs": 34,
        "intervalMs": 51,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Refraction Cutter Blade",
        "actorType": "player",
        "metadata": {
          "projectile": true,
          "finisherType": "Projectile",
          "finisherValue": 1
        }
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 4,
        "applications": 2,
        "atMs": 34,
        "intervalMs": 51,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "actorType": "summon"
      }
    ],
  },
  [ID.ESSENCE_OF_LIQUID_WRATH]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.32,
        "hits": 1,
        "name": "Essence of Liquid Wrath",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "aegis",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "protection",
        "duration": 3,
        "stacks": 1
      }
    ],
  },
  [ID.ARC_DETONATOR]: {
    "implemented": true,
    "castTimeMs": 500,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Arc Detonator — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 0.2,
        "hits": 1,
        "name": "Shock Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.ESSENCE_OF_LIVING_SHADOWS]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 645,
        "hits": 645,
        "atMs": 1,
        "intervalMs": 1,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Essence of Living Shadows",
        "actorType": "player"
      }
    ],
  },
  [ID.ESSENCE_OF_BORROWED_TIME]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Essence of Borrowed Time",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
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
  [ID.ESSENCE_OF_ANIMATED_SAND]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 8,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Essence of Animated Sand",
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 5
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 3
      }
    ],
  },
  [ID.FUNCTION_GYRO_ID_72103]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": []
  },
  [ID.FUNCTION_GYRO_ID_72114]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 1,
    "effects": []
  },
  [ID.PUNCTURING_JAB]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 440,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.45,
        "hits": 1,
        "name": "Puncturing Jab",
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
  [ID.DEVASTATOR]: {
    "implemented": true,
    "handlerId": "engineer.devastator",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Devastator",
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 4,
        "actorType": "player",
        "persistsAfterInterrupt": true
      }
    ],
  },
  [ID.ROILING_SKIES]: {
    "implemented": true,
    "handlerId": "engineer.roiling-skies",
    "castTimeMs": 1000,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Roiling Skies",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 1,
        "duration": 5,
        "actorType": "player",
      }
    ],
  },
  [ID.AMPLIFYING_SLICE]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 640,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.99,
        "hits": 1,
        "name": "Amplifying Slice",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      }
    ],
  },
  [ID.LIGHTNING_ROD]: {
    "implemented": true,
    "handlerId": "engineer.lightning-rod",
    "castTimeMs": 400,
    "quicknessCastTimeMs": 400,
    "cooldown": 12,
    "effects": [],
  },
  [ID.FOCUSED_DEVASTATION]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 6,
        "name": "Focused Devastation",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 6,
        "duration": 2,
        "actorType": "player"
      }
    ],
  },
  [ID.RENDING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 520,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.65,
        "hits": 1,
        "name": "Rending Strike",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 1,
        "duration": 8,
        "actorType": "player"
      }
    ],
  },
  [ID.CONDUIT_SURGE]: {
    "implemented": true,
    "handlerId": "engineer.conduit-surge",
    "castTimeMs": 520,
    "quicknessCastTimeMs": 520,
    "cooldown": 5,
    "effects": [],
  },
  [ID.ELECTRIC_ARTILLERY]: {
    "implemented": true,
    "handlerId": "engineer.electric-artillery",
    "castTimeMs": 780,
    "quicknessCastTimeMs": 520,
    "cooldown": 1,
    "effects": [],
  },
  [ID.STOKE_THE_FLAMES]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 440,
    "cooldown": 20,
    "comboField": "Fire",
    "duration": 1,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Stoke the Flames",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 6,
        "actorType": "player"
      },
      {
        "type": "boon",
        "boon": "quickness",
        "duration": 5,
        "stacks": 1
      },
      {
        "type": "boon",
        "boon": "might",
        "duration": 8,
        "stacks": 8
      }
    ],
    "kit": "Flamethrower",
  },
  [ID.MAGNETIC_BOMB]: {
    "implemented": true,
    "castTimeMs": 500,
    "quicknessCastTimeMs": 480,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 1880,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Magnetic Bomb",
        "actorType": "player",
        "persistsAfterInterrupt": true,
        "metadata": {
          "damageKind": "explosion"
        }
      },
      {
        "type": "control",
        "actorType": "player",
        "atMs": 1880,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "persistsAfterInterrupt": true,
        "metadata": {
          "controlKind": "pull",
          "duration": 300
        }
      }
    ],
    "kit": "Bomb Kit",
  },
  [ID.OFFENSIVE_PROTOCOL_SHRED]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 760,
    "cooldown": 20,
    "finisherType": "Projectile",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 840, "coefficient": 0.96 },
          { "atMs": 900, "coefficient": 0.96 },
          { "atMs": 960, "coefficient": 0.96 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Shred",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.SYMBIOTIC_SHIELDING]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 25,
    "effects": [],
    "toolbeltParentName": "Mitotic State",
    "mechanicSlot": 1,
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS]: {
    "implemented": true,
    "handlerId": "engineer.amalgam-morph",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Initial Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.EVOLVE]: {
    "implemented": true,
    "handlerId": "engineer.evolve",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 640,
    "cooldown": 40,
    "effects": [],
    "mechanicSlot": 5,
  },
  [ID.EVOLVE_ID_76651]: {
    "implemented": true,
    "handlerId": "engineer.evolve",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 640,
    "cooldown": 40,
    "ammo": 2,
    "effects": [],
    "mechanicSlot": 5,
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 8.100000000000001,
        "hits": 3,
        "atMs": 417,
        "intervalMs": 417,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Demolish — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Smash Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE]: {
    "implemented": true,
    "castTimeMs": 1200,
    "quicknessCastTimeMs": 800,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Offensive Protocol: Obliterate",
        "actorType": "summon"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 8,
        "duration": 6,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 3,
        "stacks": 1
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.MITOTIC_STATE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 20,
    "effects": [],
  },
  [ID.LOCKED]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_76798]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 3,
        "stacks": 1
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76806]: {
    "implemented": true,
    "castTimeMs": 1200,
    "quicknessCastTimeMs": 800,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Offensive Protocol: Obliterate",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 8,
        "duration": 6,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "name": "Offensive Protocol: Pierce",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 8,
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
    "mechanicSlot": 2,
  },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 760,
    "cooldown": 20,
    "finisherType": "Projectile",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 840, "coefficient": 0.96 },
          { "atMs": 900, "coefficient": 0.96 },
          { "atMs": 960, "coefficient": 0.96 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Shred",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.OFFENSIVE_PROTOCOL_OBLITERATE_ID_76901]: {
    "implemented": true,
    "castTimeMs": 1200,
    "quicknessCastTimeMs": 800,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "name": "Offensive Protocol: Obliterate",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 8,
        "duration": 6,
        "atMs": 640,
        "timingAnchor": "castStart",
        "timingScale": "fixed",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.LIQUID_STATE]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.2,
        "hits": 4,
        "atMs": 375,
        "intervalMs": 375,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Liquid State",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Poisoned",
        "stacks": 4,
        "duration": 12,
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Crippled",
        "stacks": 4,
        "duration": 1,
        "actorType": "player"
      }
    ],
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76927]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 8.100000000000001,
        "hits": 3,
        "atMs": 417,
        "intervalMs": 417,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Demolish — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Smash Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.OFFENSIVE_PROTOCOL_DEMOLISH_ID_76954]: {
    "implemented": true,
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 8.100000000000001,
        "hits": 3,
        "atMs": 417,
        "intervalMs": 417,
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Demolish — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1,
        "name": "Smash Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 4,
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 20,
    "effects": [],
    "mechanicSlot": 2,
  },
  [ID.FLUX_STATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 640,
    "cooldown": 50,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Flux State — Packet 1",
        "actorType": "player"
      },
      {
        "type": "strike",
        "coefficient": 9,
        "hits": 12,
        "atMs": 500,
        "intervalMs": 500,
        "intervalTimingScale": "fixed",
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Storm Damage",
        "actorType": "player"
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 1000, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 1500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 2000, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 2500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 3000, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 3500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 4000, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 4500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 5000, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 5500, "condition": "Bleeding", "stacks": 1, "duration": 5 },
          { "atMs": 6000, "condition": "Bleeding", "stacks": 1, "duration": 5 }
        ],
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
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
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77005]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "name": "Offensive Protocol: Pierce",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 8,
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
    "mechanicSlot": 3,
  },
  [ID.OFFENSIVE_PROTOCOL_PIERCE_ID_77015]: {
    "implemented": true,
    "castTimeMs": 1000,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.88,
        "hits": 1,
        "name": "Offensive Protocol: Pierce",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Vulnerability",
        "stacks": 8,
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
    "mechanicSlot": 4,
  },
  [ID.GASEOUS_STATE]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [],
  },
  [ID.SOLID_STATE]: {
    "implemented": true,
    "castTimeMs": 750,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1,
        "name": "Solid State",
        "actorType": "player"
      },
      {
        "type": "control",
        "actorType": "player",
        "metadata": {
          "controlKind": "stun",
          "duration": 2
        }
      },
      {
        "type": "boon",
        "boon": "stability",
        "duration": 5,
        "stacks": 5
      }
    ],
  },
  [ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 760,
    "cooldown": 20,
    "finisherType": "Projectile",
    "finisherValue": 1,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 840, "coefficient": 0.96 },
          { "atMs": 900, "coefficient": 0.96 },
          { "atMs": 960, "coefficient": 0.96 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Offensive Protocol: Shred",
        "actorType": "player"
      },
      {
        "type": "condition",
        "condition": "Immobilized",
        "stacks": 1,
        "duration": 3,
        "actorType": "player"
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104]: {
    "implemented": true,
    "handlerId": "engineer.amalgam-morph",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Initial Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.LOCKED_ID_77107]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  },
  [ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163]: {
    "implemented": true,
    "handlerId": "engineer.amalgam-morph",
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Initial Damage",
        "actorType": "player"
      }
    ],
    "mechanicSlot": 2,
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77203]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 20,
    "effects": [],
    "mechanicSlot": 3,
  },
  [ID.PLASMATIC_STATE]: {
    "implemented": true,
    "handlerId": "engineer.plasmatic-state",
    "castTimeMs": 720,
    "quicknessCastTimeMs": 480,
    "aftercastMs": 660,
    "quicknessAftercastMs": 440,
    "cooldown": 25,
    "effects": [
      {
        "type": "strike",
        "ticks": [
          { "atMs": 640, "coefficient": 2.25 },
          { "atMs": 1180, "coefficient": 2.25 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "name": "Plasmatic State",
        "actorType": "player",
        "persistsAfterInterrupt": true
      },
      {
        "type": "condition",
        "ticks": [
          { "atMs": 640, "condition": "Burning", "stacks": 2, "duration": 5 },
          { "atMs": 1180, "condition": "Burning", "stacks": 2, "duration": 5 }
        ],
        "timingAnchor": "castStart",
        "timingScale": "cast",
        "actorType": "player",
        "persistsAfterInterrupt": true
      }
    ],
  },
  [ID.DEFENSIVE_PROTOCOL_CLEANSE_ID_77285]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 20,
    "effects": [
      {
        "type": "boon",
        "boon": "protection",
        "duration": 3,
        "stacks": 1
      }
    ],
    "mechanicSlot": 3,
  },
  [ID.DEFENSIVE_PROTOCOL_PROTECT_ID_77358]: {
    "implemented": true,
    "castTimeMs": 1500,
    "cooldown": 20,
    "effects": [],
    "mechanicSlot": 4,
  },
  [ID.LOCKED_ID_77388]: {
    "implemented": true,
    "castTimeMs": 0,
    "cooldown": 0,
    "effects": [],
  }
});

export const ENGINEER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(ENGINEER_SKILL_MECHANICS).map(Number),
);

export const ENGINEER_TRIGGERED_MECHANICS = Object.freeze({
  [INTERNAL.MECH_BASIC_ATTACK]: Object.freeze({
    coefficient: 0.84,
    hits: 2,
    interval: 1.575,
  }),
});

const extraSkills: Skill[] = [
  {
    "id": ID.DODGE,
    "name": "Dodge",
    "description": "Perform a dodge roll.",
    "icon": "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    "type": "Action",
    "slot": "Action",
    "handlerId": "engineer.dodge",
    "castTimeMs": 800,
    "cooldown": 0,
    "implemented": true,
    "effects": []
  },
  {
    "id": ID.STOW_ELITE_MORTAR_KIT,
    "name": "Stow Elite Mortar Kit",
    "description": "Stow the elite mortar kit and return to equipped weapons.",
    "icon": "https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png",
    "type": "Elite",
    "slot": "Elite",
    "handlerId": "engineer.kit-stow",
    "kit": "Elite Mortar Kit",
    "paletteFlip": false,
    "slotSelectable": false,
    "castTimeMs": 0,
    "cooldown": 0,
    "implemented": true,
    "effects": []
  },
  {
    "id": ID.SWAP_WEAPONS,
    "name": "Swap Weapons",
    "description": "Stow the active engineer kit and return to equipped weapons.",
    "icon": "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    "type": "Action",
    "slot": "Action",
    "handlerId": "engineer.kit-stow",
    "castTimeMs": 0,
    "quicknessCastTimeMs": 0,
    "cooldown": 0,
    "rechargeAnchor": "castStart",
    "implemented": true,
    "effects": []
  }
];

export const ENGINEER_EXTRA_SKILLS = Object.freeze(
  extraSkills.map(skill => Object.freeze(skill)),
);
