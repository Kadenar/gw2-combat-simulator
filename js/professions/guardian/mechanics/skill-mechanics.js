/**
 * Authoritative guardian simulation mechanics.
 *
 * Generated API metadata supplies identity and presentation only. Every
 * field that can affect simulation results is defined in this file.
 */

import { GUARDIAN_SKILL_IDS as ID } from "../data/ids.js";
import { strikePackets } from "../../../platform/engine/effect-factories.js";

export const GUARDIAN_SKILL_MECHANICS = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 720,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      },
      {
        "type": "blind"
      }
    ]
  },
  [ID.WHIRLING_WRATH]: {
    "implemented": true,
    "castTimeMs": 2200,
    "effects": [
      strikePackets(
        5.775,
        [
          157,
          314,
          471,
          628,
          785,
          942,
          1099,
          1257,
          1414,
          1571,
          1728,
          1885,
          2042,
          2200
        ],
        {
          "timingAnchor": "castStart",
          "timingScale": "cast"
        }
      )
    ]
  },
  [ID.SHIELD_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "atMs": 4000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.RECEIVE_THE_LIGHT]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.ADVANCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.SAVE_YOURSELVES]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.PROTECTORS_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      }
    ]
  },
  [ID.SHIELD_OF_JUDGMENT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.CLEANSING_FLAME]: {
    "implemented": true,
    "castTimeMs": 4000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 10,
        "atMs": 400,
        "intervalMs": 400,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 4,
        "atMs": 4000,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.ZEALOTS_FIRE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 3
      }
    ]
  },
  [ID.SYMBOL_OF_PUNISHMENT]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 5,
        "atMs": 250,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": []
  },
  [ID.BANE_SIGNET]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SYMBOL_OF_BLADES]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.25,
        "hits": 5,
        "atMs": 250,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "blind"
      },
      {
        "type": "boon",
        "boon": "fury",
        "duration": 2,
        "stacks": 1
      }
    ]
  },
  [ID.ORB_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.666,
        "hits": 1
      }
    ]
  },
  [ID.CHAINS_OF_LIGHT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.25,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SHELTER]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.ZEALOTS_FLAME]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 4,
        "duration": 3
      }
    ]
  },
  [ID.SWORD_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1
      }
    ]
  },
  [ID.SWORD_ARC]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      }
    ]
  },
  [ID.ZEALOTS_DEFENSE]: {
    "implemented": true,
    "castTimeMs": 3000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.8,
        "hits": 8,
        "atMs": 375,
        "intervalMs": 375,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.FAITHFUL_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.55,
        "hits": 1
      }
    ]
  },
  [ID.TRUE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      }
    ]
  },
  [ID.PURE_STRIKE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.SYMBOL_OF_FAITH]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.25,
        "hits": 5,
        "atMs": 750,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.RAY_OF_JUDGMENT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.05,
        "hits": 6,
        "atMs": 750,
        "intervalMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "blind"
      }
    ]
  },
  [ID.JUSTICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.BOLT_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.65,
        "hits": 1
      }
    ]
  },
  [ID.BANISH]: {
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
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.HAMMER_OF_WISDOM]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SANCTUARY]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.GREAT_SWORD_STRIKE]: {
    "implemented": true,
    "castTimeMs": 600,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: {
    "implemented": true,
    "castTimeMs": 840,
    "quicknessCastTimeMs": 600,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 1
      }
    ]
  },
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.HOLY_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      }
    ]
  },
  [ID.SYMBOL_OF_SWIFTNESS]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 5
      }
    ]
  },
  [ID.LINE_OF_WARDING]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": []
  },
  [ID.SYMBOL_OF_RESOLUTION]: {
    "implemented": true,
    "castTimeMs": 280,
    "quicknessCastTimeMs": 280,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Symbol of Resolution — Initial"
      },
      {
        "type": "strike",
        "coefficient": 2.6,
        "hits": 4,
        "atMs": 1000,
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed",
        "name": "Symbol of Resolution"
      }
    ]
  },
  [ID.BINDING_BLADE]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 480,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "atMs": 750,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SIGNET_OF_JUDGMENT]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      }
    ]
  },
  [ID.SIGNET_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.25,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 3,
        "duration": 5
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.HOLD_THE_LINE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.STAND_YOUR_GROUND]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.RENEWED_FOCUS]: {
    "implemented": true,
    "castTimeMs": 2000,
    "handlerId": "guardian.renewed-focus",
    "effects": []
  },
  [ID.SIGNET_OF_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.HAMMER_SWING]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1
      }
    ]
  },
  [ID.SYMBOL_OF_PROTECTION]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Symbol of Protection — Hammer Damage"
      },
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 3,
        "name": "Symbol of Protection — Symbol Damage"
      }
    ]
  },
  [ID.SIGNET_OF_MERCY]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.SWORD_OF_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 900,
    "cooldown": 20,
    "ammo": 3,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.2,
        "hits": 4,
        "atMs": 650,
        "intervalMs": 400,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.BOW_OF_TRUTH]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.SHIELD_OF_THE_AVENGER]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      }
    ]
  },
  [ID.PURGING_FLAMES]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 6,
        "atMs": 250,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 1250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 2250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 3250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 4250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 5250,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.MIGHTY_BLOW]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1
      }
    ]
  },
  [ID.RING_OF_WARDING]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": []
  },
  [ID.SHIELD_OF_ABSORPTION_ID_9224]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": []
  },
  [ID.PULL]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SWORD_WAVE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.65,
        "hits": 3
      }
    ]
  },
  [ID.SMITE_CONDITION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.9,
        "hits": 1,
        "name": "Smite Condition — Damage With Condition"
      }
    ]
  },
  [ID.MERCIFUL_INTERVENTION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.JUDGES_INTERVENTION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 8
      }
    ]
  },
  [ID.CONTEMPLATION_OF_PURITY]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.VIRTUE_OF_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.WALL_OF_REFLECTION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.HALLOWED_GROUND]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.ZEALOTS_EMBRACE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.25,
        "hits": 1
      }
    ]
  },
  [ID.EMPOWER]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": []
  },
  [ID.VIRTUE_OF_COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.SHIELD_OF_JUDGMENT_ID_15834]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.LITANY_OF_WRATH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.DEFLECTING_SHOT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.TEST_OF_FAITH]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.SYMBOL_OF_ENERGY]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.38,
        "hits": 1,
        "name": "Symbol of Energy — Initial Damage"
      },
      {
        "type": "strike",
        "coefficient": 0.5175,
        "hits": 5,
        "intervalMs": 1000,
        "name": "Symbol of Energy — Symbol Damage",
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 12
      }
    ]
  },
  [ID.SPEAR_OF_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
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
        "duration": 4
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      }
    ]
  },
  [ID.FEEL_MY_WRATH]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.PURIFICATION]: {
    "implemented": true,
    "castTimeMs": 660,
    "quicknessCastTimeMs": 600,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1875,
        "hits": 1,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "blind"
      }
    ]
  },
  [ID.SHIELD_OF_COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.WINGS_OF_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.TRUE_SHOT]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.8,
        "hits": 1
      }
    ]
  },
  [ID.DRAGONS_MAW]: {
    "implemented": true,
    "castTimeMs": 660,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 1,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.PROCESSION_OF_BLADES]: {
    "implemented": true,
    "castTimeMs": 660,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.4,
        "hits": 10,
        "atMs": 1280,
        "intervalMs": 280,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.SIGNET_OF_COURAGE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.PUNCTURE_SHOT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.FRAGMENTS_OF_FAITH]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      }
    ]
  },
  [ID.HUNTERS_WARD]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Hunter's Ward — Initial Damage"
      },
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Hunter's Ward — Final Impact Damage"
      }
    ]
  },
  [ID.LIGHTS_JUDGMENT]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.1875,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.HUNTERS_VERDICT]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SCORCHED_AFTERMATH]: {
    "implemented": true,
    "castTimeMs": 500,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.2,
        "hits": 5,
        "atMs": 500,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "atMs": 1500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "atMs": 2500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "atMs": 3500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3,
        "atMs": 4500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "atMs": 1500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "atMs": 2500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "atMs": 3500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 5,
        "atMs": 4500,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.PORTENT_OF_FREEDOM]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SYMBOL_OF_VENGEANCE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 5
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 5,
        "duration": 3
      }
    ]
  },
  [ID.IGNITING_BURST]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 10
      }
    ]
  },
  [ID.RADIANT_RECOVERY]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.MANTRA_OF_POTENCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.STALWART_STAND]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SEARING_SPELL]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.95,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2.5
      }
    ]
  },
  [ID.STOW_TOME]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.stow-tome",
    "effects": []
  },
  [ID.RESTORING_REPRIEVE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.SHIELD_OF_THE_AVENGER_ID_41571]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1
      }
    ]
  },
  [ID.MANTRA_OF_SOLACE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.TOME_OF_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.VALIANT_BULWARK]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.DARING_CHALLENGE]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.4,
        "hits": 1
      }
    ]
  },
  [ID.OVERWHELMING_CELERITY]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.SHINING_RIVER]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.TOME_OF_COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.ECHO_OF_TRUTH]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 1
      }
    ]
  },
  [ID.TOME_OF_COURAGE_ID_42371]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.HEATED_REBUKE]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.45,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.OPENING_PASSAGE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.ASHES_OF_THE_JUST]: {
    "implemented": true,
    "castTimeMs": 750,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.ETERNAL_OASIS]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.POTENT_HASTE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.UNFLINCHING_CHARGE]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.MANTRA_OF_LIBERATION]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.BOW_OF_TRUTH_ID_43565]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.SEARING_SLASH]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 2
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 2,
        "duration": 2
      }
    ]
  },
  [ID.MANTRA_OF_TRUTH]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.CLARIFIED_CONCLUSION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.TOME_OF_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.UNBROKEN_LINES]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.BLEEDING_EDGE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.72,
        "hits": 2
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 1
      }
    ]
  },
  [ID.SWORD_OF_JUSTICE_ID_44846]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.2,
        "hits": 4
      }
    ]
  },
  [ID.DESERT_BLOOM]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.CORE_CLEAVE]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.72,
        "hits": 2
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 2,
        "duration": 1
      }
    ]
  },
  [ID.FLAME_RUSH]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 12
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      }
    ]
  },
  [ID.AZURE_SUN]: {
    "implemented": true,
    "castTimeMs": 250,
    "handlerId": "guardian.tome-page",
    "effects": []
  },
  [ID.BLAZING_EDGE]: {
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
        "duration": 3
      }
    ]
  },
  [ID.MANTRA_OF_LORE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.MANTRA_OF_FLAME]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.HAMMER_OF_WISDOM_ID_46170]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.SEEKING_JUDGMENT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1
      }
    ]
  },
  [ID.SEARING_LIGHT]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1
      }
    ]
  },
  [ID.GLACIAL_BLOW]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1
      }
    ]
  },
  [ID.ROILING_LIGHT]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.33,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      },
      {
        "type": "blind"
      }
    ]
  },
  [ID.EXECUTIONERS_CALLING]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1
      },
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 4,
        "name": "Executioner's Calling — Secondary Attacks"
      }
    ]
  },
  [ID.WILLBENDER_FLAMES]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.22,
        "hits": 1
      }
    ]
  },
  [ID.CRASHING_COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Crashing Courage — Initial Damage"
      }
    ]
  },
  [ID.HEEL_CRACK]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.HEAVENS_PALM]: {
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
      }
    ]
  },
  [ID.WHIRLING_LIGHT]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4,
        "hits": 4
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 3
      }
    ]
  },
  [ID.FLOWING_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.FLASH_COMBO]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 4.5,
        "hits": 5
      }
    ]
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.22,
        "hits": 1
      }
    ]
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.CRASHING_COURAGE_ID_62648]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Crashing Courage — Initial Damage"
      }
    ]
  },
  [ID.ADVANCING_STRIKE]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 2
      }
    ]
  },
  [ID.RUSHING_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Rushing Justice — Impact Damage"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 4
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      }
    ]
  },
  [ID.REPOSE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.QUICK_RETRIBUTION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.TOME_OF_JUSTICE_ID_68647]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": [
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 4
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.TOME_OF_RESOLVE_ID_68648]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.TOME_OF_COURAGE_ID_68650]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RENEWED_FOCUS_ID_68666]: {
    "implemented": true,
    "castTimeMs": 1000,
    "handlerId": "guardian.renewed-focus",
    "effects": []
  },
  [ID.FEEL_MY_WRATH_ID_68670]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.SIGNET_OF_COURAGE_ID_68676]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.DRAGONS_MAW_ID_68686]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.JURISDICTION]: {
    "implemented": true,
    "castTimeMs": 750,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 5,
        "duration": 6
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.HAIL_OF_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 250,
    "cooldown": 10,
    "ammo": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 5,
        "atMs": 50,
        "intervalMs": 50,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "atMs": 50,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "atMs": 100,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "atMs": 150,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "atMs": 200,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8,
        "atMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.PEACEKEEPER]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 5,
        "atMs": 100,
        "intervalMs": 100,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 100,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 200,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 300,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 400,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 2,
        "atMs": 500,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.SYMBOL_OF_IGNITION]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 5,
        "atMs": 250,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "condition",
        "condition": "Burning",
        "stacks": 1,
        "duration": 1,
        "atMs": 250,
        "timingAnchor": "castStart",
        "timingScale": "cast"
      }
    ]
  },
  [ID.THROUGH_THE_HEART]: {
    "implemented": true,
    "castTimeMs": 500,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.6,
        "hits": 1
      },
      {
        "type": "condition",
        "condition": "Bleeding",
        "stacks": 1,
        "duration": 8
      }
    ]
  },
  [ID.HELIO_RUSH]: {
    "implemented": true,
    "castTimeMs": 320,
    "cooldown": 6.4,
    "ammo": 2,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "atMs": 160,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.GLEAMING_DISC]: {
    "implemented": true,
    "castTimeMs": 560,
    "cooldown": 9.6,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 2,
        "atMs": 480,
        "intervalMs": 680,
        "name": "Gleaming Disc",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.DAYBREAKING_SLASH]: {
    "implemented": true,
    "castTimeMs": 520,
    "effects": [
      {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 1
      }
    ]
  },
  [ID.SOLAR_STORM]: {
    "implemented": true,
    "castTimeMs": 560,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 560,
        "name": "Solar Storm — 1st Strike",
        "timingAnchor": "castStart",
        "timingScale": "cast"
      },
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "atMs": 760,
        "name": "Solar Storm — 2nd Strike",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1,
        "atMs": 960,
        "name": "Solar Storm — 3rd Strike",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.SYMBOL_OF_LUMINANCE]: {
    "implemented": true,
    "castTimeMs": 440,
    "quicknessCastTimeMs": 440,
    "cooldown": 15,
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "atMs": 360,
        "name": "Symbol of Luminance — Initial",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      },
      {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 5,
        "atMs": 360,
        "intervalMs": 1000,
        "name": "Symbol of Luminance",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.EXIT_RADIANT_FORGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.radiant-forge",
    "effects": []
  },
  [ID.RESOLUTE_STANCE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "effects": []
  },
  [ID.DARING_ADVANCE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 1000,
    "effects": [
      {
        "type": "strike",
        "coefficient": 3,
        "hits": 1
      }
    ]
  },
  [ID.LUMINOUS_STAFF]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 560,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 4,
        "intervalMs": 1000,
        "name": "Luminous Staff — Symbol Damage",
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
      }
    ]
  },
  [ID.EFFULGENT_STANCE]: {
    "implemented": true,
    "castTimeMs": 0,
    "effects": []
  },
  [ID.SHINING_SPIN]: {
    "implemented": true,
    "castTimeMs": 600,
    "quicknessCastTimeMs": 480,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.25,
        "hits": 1
      }
    ]
  },
  [ID.GLEAMING_BLADE]: {
    "implemented": true,
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 840,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1
      }
    ]
  },
  [ID.BRILLIANT_SLAM]: {
    "implemented": true,
    "castTimeMs": 600,
    "quicknessCastTimeMs": 480,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      }
    ]
  },
  [ID.GLARING_BURST]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 600,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      }
    ]
  },
  [ID.ENTER_RADIANT_FORGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.radiant-forge",
    "effects": []
  },
  [ID.PIERCING_STANCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "quicknessCastTimeMs": 200,
    "effects": [
      {
        "type": "strike",
        "coefficient": 2,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "daze",
          "duration": 0.5
        }
      }
    ]
  },
  [ID.RESTORATIVE_GLOW]: {
    "implemented": true,
    "castTimeMs": 750,
    "quicknessCastTimeMs": 560,
    "handlerId": "guardian.radiant-weapon",
    "effects": []
  },
  [ID.RADIANT_BULWARK]: {
    "implemented": true,
    "castTimeMs": 2000,
    "handlerId": "guardian.radiant-weapon",
    "effects": []
  },
  [ID.VALOROUS_STANCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": []
  },
  [ID.STALWART_STANCE]: {
    "implemented": true,
    "castTimeMs": 250,
    "effects": [
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      }
    ]
  },
  [ID.DAZZLING_HAMMER]: {
    "implemented": true,
    "castTimeMs": 600,
    "quicknessCastTimeMs": 470,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "daze",
          "duration": 2
        }
      }
    ]
  },
  [ID.LUCENT_THRUST]: {
    "implemented": true,
    "castTimeMs": 600,
    "quicknessCastTimeMs": 440,
    "handlerId": "guardian.radiant-weapon",
    "effects": [
      {
        "type": "strike",
        "coefficient": 1,
        "hits": 1
      },
      {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Lucent Thrust — Projectile Damage"
      },
      {
        "type": "control",
        "metadata": {
          "controlKind": "control"
        }
      },
      {
        "type": "blind"
      }
    ]
  },
  [ID.RADIANT_COURAGE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RADIANT_RESOLVE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RADIANT_RESOLVE_ID_78604]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RADIANT_COURAGE_ID_78770]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
  [ID.RADIANT_JUSTICE]: {
    "implemented": true,
    "castTimeMs": 0,
    "handlerId": "guardian.virtue",
    "effects": []
  },
});

export const GUARDIAN_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(GUARDIAN_SKILL_MECHANICS).map(Number),
);

export const GUARDIAN_EXTRA_SKILLS = Object.freeze([Object.freeze({
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
  handlerId: "guardian.weapon-swap",
  effects: [],
})]);

export const GUARDIAN_HANDLER_MECHANICS = Object.freeze({
  spear: Object.freeze({
    illuminatedMultiplierBySkillId: Object.freeze({
      [ID.HELIO_RUSH]: 1.5,
      [ID.GLEAMING_DISC]: 1.25,
      [ID.SOLAR_STORM]: 1.25,
    }),
    illuminationArmers: Object.freeze([
      ID.HELIO_RUSH,
      ID.GLEAMING_DISC,
      ID.SOLAR_STORM,
    ]),
    symbolLuminanceDurationMs: 5000,
  }),
  radiantForge: Object.freeze({
    glaringBurstCoefficientByWeapon: Object.freeze({
      hammer: 1.25,
      blade: 1,
    }),
  }),
  justiceBurn: Object.freeze({
    condition: "Burning",
    stacks: 1,
    duration: 2,
  }),
  ashesBurn: Object.freeze({
    condition: "Burning",
    stacks: 1,
    duration: 2,
    interval: 1,
  }),
});
