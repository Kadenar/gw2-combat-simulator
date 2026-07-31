import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

export const SPECTER_SKILL_MECHANICS = Object.freeze({
  [ID.SIPHON]: {
      "implemented": true,
      "movementSkill": true,
      "handlerId": "thief.siphon",
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
      "movementSkill": true,
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
      "movementSkill": true,
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
      "movementSkill": true,
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
      "movementSkill": true,
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
  [ID.WELL_OF_BOUNTY]: {
      "implemented": true,
      "movementSkill": true,
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
});
