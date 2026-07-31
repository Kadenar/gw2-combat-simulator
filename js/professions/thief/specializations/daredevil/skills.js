import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

export const DAREDEVIL_SKILL_MECHANICS = Object.freeze({
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
});
