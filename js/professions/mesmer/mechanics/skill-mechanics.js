/**
 * Authoritative mesmer simulation mechanics.
 *
 * Generated API metadata supplies identity and presentation only. Every
 * field that can affect simulation results is defined in this file.
 */

import { MESMER_SKILL_IDS as ID } from "../data/ids.js";

export const MESMER_SKILL_MECHANICS = Object.freeze({
  [ID.CONFUSING_IMAGES]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 9,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Confusing_Images",
    "effects": [
    {
        "type": "strike",
        "coefficient": 5.32,
        "hits": 7,
        "name": "Damage",
        "actorType": "player",
        "weapon": "scepter"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 7,
        "stacks": 7
    }
],
    "castTimeMs": 2775,
    "quicknessCastTimeMs": 1850,
    "pulseCount": 7
  },
  [ID.CHAOS_STORM]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Chaos_Storm",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.98,
        "hits": 6,
        "name": "Six pulses",
        "actorType": "player",
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    },
    {
        "type": "condition",
        "condition": "Poisoned",
        "duration": 4,
        "stacks": 2
    }
],
    "castTimeMs": 720,
  },
  [ID.MIND_SLASH]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Slash",
    "chainRoot": 10170,
    "chainStep": 1,
    "nextChainId": 10171,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
],
    "castTimeMs": 540
  },
  [ID.MIND_GASH]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 780,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Gash",
    "chainRoot": 10170,
    "chainStep": 2,
    "nextChainId": 10172,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
]
  },
  [ID.MIND_SPIKE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1260,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "boonlessCoefficient": 2,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Spike",
    "chainRoot": 10170,
    "chainStep": 3,
    "nextChainId": null,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
]
  },
  [ID.ILLUSIONARY_LEAP]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 600,
    "cooldown": 12,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Leap",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.003,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
]
  },
  [ID.PHANTASMAL_SWORDSMAN]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 15,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    // 720ms of the measured 880ms Quickness cast.
    "phantasmSummonProgress": 0.8181818181818182,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Swordsman",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Mesmer strike",
        "actorType": "player",
        "weapon": "sword",
        "castProgress": 0.8625
    },
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Phantasm leap",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    },
    {
        "type": "strike",
        "coefficient": 1.6,
        "hits": 8,
        "name": "Phantasm Blurred Frenzy",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    }
],
    "castTimeMs": 1320,
  },
  [ID.PHANTASMAL_DUELIST]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Pistol",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 16,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Duelist",
    "effects": [
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 350,
                "coefficient": 0.33
            },
            {
                "atMs": 350,
                "coefficient": 0.33
            },
            {
                "atMs": 400,
                "coefficient": 0.33
            }
        ],
        "name": "Damage",
        "actorType": "player",
        "weapon": "pistol",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 0.92,
        "hits": 8,
        "name": "Illusion Damage",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    },
    {
        "type": "condition",
        "condition": "bleeding",
        "duration": 4,
        "stacks": 8,
        "packetLabel": "Illusion Damage"
    }
],
    "castTimeMs": 840,
  },
  [ID.ETHER_FEAST]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Feast",
    "effects": []
  },
  [ID.MIRROR]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 833.333333333,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror",
    "effects": []
  },
  [ID.TEMPORAL_CURTAIN]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Focus",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1110,
    "quicknessCastTimeMs": 740,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Temporal_Curtain",
    "effects": []
  },
  [ID.PHANTASMAL_MAGE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Torch",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Mage",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.19,
        "hits": 1,
        "name": "Mesmer attack",
        "actorType": "player",
        "weapon": "torch"
    },
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Phantasm attack",
        "actorType": "phantasm",
        "weapon": "torch"
    },
    {
        "type": "condition",
        "condition": "burning",
        "duration": 9,
        "stacks": 1
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 3,
        "stacks": 3
    }
],
    "castTimeMs": 1200,
  },
  [ID.CRY_OF_FRUSTRATION]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Cry_of_Frustration",
    "effects": []
  },
  [ID.MIND_WRACK]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Wrack",
    "effects": []
  },
  [ID.DISTORTION]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 50,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Distortion",
    "effects": []
  },
  [ID.PORTAL_ENTRE]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 72,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Portal_Entre",
    "effects": []
  },
  [ID.BLINK]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blink",
    "effects": []
  },
  [ID.DECOY]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Decoy",
    "effects": []
  },
  [ID.MIRROR_IMAGES]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 25,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 2
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror_Images",
    "effects": []
  },
  [ID.NULL_FIELD]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Null_Field",
    "effects": []
  },
  [ID.MANTRA_OF_PAIN]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 2250,
    "quicknessCastTimeMs": 1500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mantra_of_Pain",
    "effects": []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 2250,
    "quicknessCastTimeMs": 1500,
    "cooldown": 10,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mantra_of_Recovery",
    "effects": []
  },
  [ID.PHANTASMAL_WARLOCK]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 12,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 2
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Warlock",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.45,
        "hits": 3,
        "name": "One warlock",
        "actorType": "phantasm",
        "weapon": "Phantasm high"
    },
    {
        "type": "condition",
        "condition": "Torment",
        "duration": 4,
        "stacks": 6
    }
],
    "castTimeMs": 1170,
    "quicknessCastTimeMs": 780,
  },
  [ID.MIND_STAB]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 10,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Stab",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.8,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "greatsword"
    }
],
    "castTimeMs": 540
  },
  [ID.SPATIAL_SURGE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1125,
    "quicknessCastTimeMs": 750,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Spatial_Surge",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 3,
        "name": "Maximum-range damage",
        "actorType": "player"
    }
],
    "pulseCount": 3,
  },
  [ID.ILLUSIONARY_WAVE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 960,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Wave",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "greatsword"
    }
]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 12,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Berserker",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 4,
        "name": "One berserker",
        "actorType": "phantasm",
        "weapon": "phantasm high"
    },
    {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 1,
        "name": "Greatsword damage",
        "actorType": "player",
        "weapon": "greatsword"
    }
],
    "castTimeMs": 840,
  },
  [ID.MAGIC_BULLET]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Pistol",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Magic_Bullet",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.2,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "pistol"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 5,
        "stacks": 3
    }
],
    "castTimeMs": 660
  },
  [ID.SIGNET_OF_DOMINATION]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Domination",
    "effects": []
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Midnight",
    "effects": []
  },
  [ID.SIGNET_OF_INSPIRATION]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Inspiration",
    "effects": []
  },
  [ID.MASS_INVISIBILITY]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 833.333333333,
    "cooldown": 35,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mass_Invisibility",
    "effects": []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1680,
    "cooldown": 60,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Illusions",
    "effects": []
  },
  [ID.SIRENS_CALL]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Siren's_Call",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.3,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "trident"
    },
    {
        "type": "condition",
        "condition": "bleeding",
        "duration": 1,
        "stacks": 1
    }
]
  },
  [ID.BLINDING_TIDE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 8,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blinding_Tide",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.8,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "trident"
    }
]
  },
  [ID.ILLUSION_OF_DROWNING]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusion_of_Drowning",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.28,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "trident"
    }
]
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Disenchanter",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Target without boons",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    }
],
    "castTimeMs": 1140,
  },
  [ID.WINDS_OF_CHAOS]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Winds_of_Chaos",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.6,
        "hits": 2,
        "name": "Damage",
        "actorType": "player",
        "weapon": "staff"
    },
    {
        "type": "condition",
        "condition": "torment",
        "duration": 5,
        "stacks": 1
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 5,
        "stacks": 1
    }
],
    "castTimeMs": 1140
  },
  [ID.ILLUSIONARY_COUNTER]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 2000,
    "quicknessCastTimeMs": 1333.333333333,
    "cooldown": 6,
    "phantasm": false,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Counter",
    "effects": [],
    "resource": null,
    "defaultInterruptMs": 120
  },
  [ID.ILLUSIONARY_RIPOSTE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 2250,
    "quicknessCastTimeMs": 1500,
    "cooldown": 12,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Riposte",
    "effects": [
    {
        "type": "strike",
        "coefficient": 2,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
],
    "defaultInterruptMs": 120
  },
  [ID.PHANTASMAL_WARDEN]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Focus",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Warden",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.656,
        "hits": 12,
        "name": "Damage",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    }
],
    "castTimeMs": 690,
    "quicknessCastTimeMs": 460,
  },
  [ID.THE_PRESTIGE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Torch",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/The_Prestige",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "torch"
    },
    {
        "type": "condition",
        "condition": "burning",
        "duration": 9,
        "stacks": 1
    }
]
  },
  [ID.DIVERSION]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 38,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Diversion",
    "effects": []
  },
  [ID.ETHER_BOLT]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Bolt",
    "chainRoot": 10289,
    "chainStep": 1,
    "nextChainId": 10290,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "scepter"
    },
    {
        "type": "condition",
        "condition": "torment",
        "duration": 4,
        "stacks": 1
    }
],
    "castTimeMs": 660
  },
  [ID.ETHER_BLAST]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 780,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Blast",
    "chainRoot": 10289,
    "chainStep": 2,
    "nextChainId": 10291,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "scepter"
    },
    {
        "type": "condition",
        "condition": "Torment",
        "duration": 6,
        "stacks": 1
    }
]
  },
  [ID.ETHER_CLONE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1260,
    "cooldown": 0,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "maxCloneEffects": [
      {
        "type": "condition",
        "condition": "Torment",
        "duration": 9,
        "stacks": 1
      }
    ],
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Clone",
    "chainRoot": 10289,
    "chainStep": 3,
    "nextChainId": null,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.75,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "scepter"
    }
]
  },
  [ID.FEEDBACK]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 32,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Feedback",
    "effects": []
  },
  [ID.PHASE_RETREAT]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 8,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phase_Retreat",
    "effects": []
  },
  [ID.TIME_WARP]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 960,
    "cooldown": 120,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Time_Warp",
    "effects": []
  },
  [ID.IMMINENT_VOYAGE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 12,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Imminent_Voyage",
    "effects": []
  },
  [ID.CHAOS_ARMOR]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 16,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Chaos_Armor",
    "effects": [
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 5,
        "stacks": 3
    }
]
  },
  [ID.MIRROR_BLADE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1080,
    "cooldown": 5,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror_Blade",
    "effects": [
    {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Initial target hit",
        "actorType": "player",
        "weapon": "greatsword"
    },
    {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1,
        "name": "Second target hit after one ally bounce",
        "actorType": "player",
        "weapon": "greatsword",
        "atMs": 300,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 0.004,
        "hits": 1,
        "name": "Third target hit after two ally bounces",
        "actorType": "player",
        "weapon": "greatsword",
        "atMs": 600,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 0.00016,
        "hits": 1,
        "name": "Fourth target hit after three ally bounces",
        "requiredTrait": "Bountiful Blades",
        "actorType": "player",
        "weapon": "greatsword",
        "atMs": 900,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    }
],
  },
  [ID.BLURRED_FRENZY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1440,
    "cooldown": 10,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blurred_Frenzy",
    "effects": [
    {
        "type": "strike",
        "coefficient": 3.6,
        "hits": 8,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
],
  },
  [ID.PHANTASMAL_DEFENDER]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 40,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Defender",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.4,
        "hits": 1,
        "name": "Damage",
        "actorType": "phantasm",
        "weapon": "phantasm defender"
    }
],
    "castTimeMs": 1155,
    "quicknessCastTimeMs": 770,
  },
  [ID.SIGNET_OF_THE_ETHER]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 30,
    "phantasm": false,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_the_Ether",
    "effects": [],
    "resource": null,
    "castTimeMs": 1380
  },
  [ID.THOUSAND_CUTS]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "cooldown": 60,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Thousand_Cuts",
    "effects": [
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 0,
                "coefficient": 0.5
            },
            {
                "atMs": 517,
                "coefficient": 0.5
            },
            {
                "atMs": 1033,
                "coefficient": 0.5
            },
            {
                "atMs": 1550,
                "coefficient": 0.5
            },
            {
                "atMs": 2067,
                "coefficient": 0.5
            },
            {
                "atMs": 2600,
                "coefficient": 0.5
            },
            {
                "atMs": 3117,
                "coefficient": 0.5
            },
            {
                "atMs": 3633,
                "coefficient": 0.5
            },
            {
                "atMs": 4150,
                "coefficient": 0.5
            },
            {
                "atMs": 4667,
                "coefficient": 0.5
            }
        ],
        "name": "Damage",
        "actorType": "player",
        "weapon": "unequipped",
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    }
]
  },
  [ID.SIGNET_OF_HUMILITY]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 45,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Humility",
    "effects": []
  },
  [ID.WELL_OF_PRECOGNITION]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 60,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Precognition",
    "effects": []
  },
  [ID.MIMIC]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mimic",
    "effects": []
  },
  [ID.CONTINUUM_SPLIT]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 105,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Continuum_Split",
    "effects": []
  },
  [ID.WELL_OF_SENILITY]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 1140,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Senility",
    "effects": [
    {
        "type": "strike",
        "coefficient": 4.5,
        "hits": 3,
        "name": "Pulse damage",
        "actorType": "player",
        "weapon": "utility"
    }
],
  },
  [ID.WELL_OF_ETERNITY]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 30,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Eternity",
    "effects": []
  },
  [ID.GRAVITY_WELL]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 1560,
    "cooldown": 60,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Gravity_Well",
    "effects": [
    {
        "type": "strike",
        "coefficient": 3.3,
        "hits": 3,
        "name": "Pulse damage",
        "actorType": "player",
        "weapon": "utility",
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 2.1,
        "hits": 1,
        "name": "Final damage",
        "actorType": "player",
        "weapon": "utility",
        "atMs": 3000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    }
],
  },
  [ID.WELL_OF_CALAMITY]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 1200,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Calamity",
    "effects": [
    {
        "type": "strike",
        "coefficient": 3.9,
        "hits": 3,
        "name": "Pulse damage",
        "actorType": "player",
        "weapon": "utility",
        "intervalMs": 1000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 2.1,
        "hits": 1,
        "name": "Final damage",
        "actorType": "player",
        "weapon": "utility",
        "atMs": 3000,
        "timingAnchor": "castEnd",
        "timingScale": "fixed"
    }
],
  },
  [ID.TIDES_OF_TIME]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Shield",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 1020,
    "cooldown": 35,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tides_of_Time",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "shield"
    }
]
  },
  [ID.ECHO_OF_MEMORY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Shield",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "cooldown": 30,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Echo_of_Memory",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.9,
        "hits": 1,
        "name": "Damage",
        "actorType": "phantasm",
        "weapon": "phantasm medium"
    }
],
    "castTimeMs": 2460,
  },
  [ID.WELL_OF_ACTION]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 1200,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Action",
    "effects": [
    {
        "type": "strike",
        "coefficient": 4.5,
        "hits": 3,
        "name": "Pulse damage",
        "actorType": "player",
        "weapon": "utility"
    }
],
  },
  [ID.SWORD_OF_DECIMATION]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Sword_of_Decimation",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    }
]
  },
  [ID.FALSE_OASIS]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1440,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/False_Oasis",
    "effects": []
  },
  [ID.CRYSTAL_SANDS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 600,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Crystal_Sands",
    "effects": [
    {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 6,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 4,
        "stacks": 1
    }
]
  },
  [ID.MIRROR_STRIKES]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1080,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror_Strikes",
    "chainRoot": 44791,
    "chainStep": 3,
    "nextChainId": null,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.1,
        "hits": 2,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "Bleeding",
        "duration": 6,
        "stacks": 1
    },
    {
        "type": "condition",
        "condition": "Torment",
        "duration": 6,
        "stacks": 1
    }
]
  },
  [ID.MIRAGE_ADVANCE]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirage_Advance",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    }
]
  },
  [ID.SAND_THROUGH_GLASS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Sand_through_Glass",
    "effects": []
  },
  [ID.BLADE_RENEWAL]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 2000,
    "quicknessCastTimeMs": 1333.333333333,
    "cooldown": 35,
    "phantasm": false,
    "resource": {
      "mode": "fill",
      "count": 5
    },
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blade_Renewal",
    "effects": []
  },
  [ID.AXES_OF_SYMMETRY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 8,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Axes_of_Symmetry",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 5
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 1
    }
],
    "castTimeMs": 1530,
    "quicknessCastTimeMs": 1020
  },
  [ID.LACERATING_CHOP]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lacerating_Chop",
    "chainRoot": 44791,
    "chainStep": 1,
    "nextChainId": 44840,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "Bleeding",
        "duration": 2,
        "stacks": 1
    }
],
    "castTimeMs": 645,
    "quicknessCastTimeMs": 430,
  },
  [ID.ETHEREAL_CHOP]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 795,
    "quicknessCastTimeMs": 530,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ethereal_Chop",
    "chainRoot": 44791,
    "chainStep": 2,
    "nextChainId": 41164,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.55,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "Torment",
        "duration": 2,
        "stacks": 1
    }
]
  },
  [ID.ILLUSIONARY_AMBUSH]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Ambush",
    "effects": []
  },
  [ID.LINGERING_THOUGHTS]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 0.25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lingering_Thoughts",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 3,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "torment",
        "duration": 4,
        "stacks": 3
    }
],
    "castTimeMs": 1395,
    "quicknessCastTimeMs": 930
  },
  [ID.RAIN_OF_SWORDS]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 1020,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Rain_of_Swords",
    "effects": [
    {
        "type": "strike",
        "coefficient": 6,
        "hits": 5,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    }
],
  },
  [ID.JAUNT]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0.5,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Jaunt",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 3
    }
]
  },
  [ID.TIME_SINK]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 38,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Time_Sink",
    "effects": []
  },
  [ID.REWINDER]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 30,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Rewinder",
    "effects": []
  },
  [ID.SPLIT_SECOND]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Split_Second",
    "effects": []
  },
  [ID.FLYING_CUTTER]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 660,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Flying_Cutter",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Projectile",
        "actorType": "player",
        "castProgress": 0.72
    }
],
    "trackedHitDamage": {
      "hitsRequired": 3,
      "duration": 5,
      "skillId": ID.CUTTER_BURST,
      "wikiUrl": "https://wiki.guildwars2.com/wiki/Cutter_Burst",
      "name": "Cutter Burst",
      "actorType": "player",
      "ticks": [
        { "atMs": 217, "coefficient": 0.2 },
        { "atMs": 250, "coefficient": 0.2 },
        { "atMs": 384, "coefficient": 0.2 }
      ]
    }
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Twin_Blade_Restoration",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.7,
        "hits": 2,
        "name": "Damage",
        "actorType": "player",
        "weapon": "unequipped"
    }
]
  },
  [ID.TROUBADOUR_BLADECALL]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 5,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladecall",
    "effects": [
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 199,
                "coefficient": 0.25
            },
            {
                "atMs": 199,
                "coefficient": 0.25
            },
            {
                "atMs": 199,
                "coefficient": 0.25
            }
        ],
        "name": "Outgoing damage",
        "actorType": "player",
        "weapon": "dagger",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 2716,
                "coefficient": 0.25
            },
            {
                "atMs": 2716,
                "coefficient": 0.25
            },
            {
                "atMs": 2766,
                "coefficient": 0.25
            }
        ],
        "name": "Returning damage",
        "actorType": "player",
        "weapon": "dagger",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    }
],
    "castTimeMs": 660,
  },
  [ID.BLADE_LEAP]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 12,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blade_Leap",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
]
  },
  [ID.PSYCHIC_FORCE]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 3,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Psychic_Force",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    }
]
  },
  [ID.BLADETURN_REQUIEM]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "cooldown": 30,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladeturn_Requiem",
    "effects": []
  },
  [ID.BLADESONG_DISSONANCE]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 720,
    "cooldown": 30,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Dissonance",
    "effects": []
  },
  [ID.UNSTABLE_BLADESTORM]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 660,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Unstable_Bladestorm",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 4,
        "name": "Storm pulses",
        "actorType": "player",
        "atMs": 1156,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "coefficient": 2,
        "hits": 4,
        "name": "Launched blades",
        "actorType": "player",
        "atMs": 1198,
        "intervalMs": 1000,
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    }
],
  },
  [ID.BLADESONG_SORROW]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 720,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Sorrow",
    "effects": []
  },
  [ID.BLADESONG_HARMONY]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 960,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Harmony",
    "effects": []
  },
  [ID.BLADESONG_DISTORTION]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 50,
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Distortion",
    "effects": []
  },
  [ID.BLADECALL]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 5,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1,
      "timingAnchor": "castStart",
      "atMs": 199
    },
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladecall",
    "effects": [
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 199,
                "coefficient": 0.25
            },
            {
                "atMs": 199,
                "coefficient": 0.25
            },
            {
                "atMs": 199,
                "coefficient": 0.25
            }
        ],
        "name": "Outgoing damage",
        "actorType": "player",
        "weapon": "dagger",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    },
    {
        "type": "strike",
        "ticks": [
            {
                "atMs": 2716,
                "coefficient": 0.25
            },
            {
                "atMs": 2716,
                "coefficient": 0.25
            },
            {
                "atMs": 2766,
                "coefficient": 0.25
            }
        ],
        "name": "Returning damage",
        "actorType": "player",
        "weapon": "dagger",
        "timingAnchor": "castStart",
        "timingScale": "fixed"
    }
],
    "castTimeMs": 660,
  },
  [ID.TROUBADOUR_LINGERING_THOUGHTS]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 0.25,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lingering_Thoughts",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.2,
        "hits": 3,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "torment",
        "duration": 4,
        "stacks": 3
    }
],
    "castTimeMs": 1395,
    "quicknessCastTimeMs": 930
  },
  [ID.TROUBADOUR_AXES_OF_SYMMETRY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 8,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Axes_of_Symmetry",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.75,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "axe"
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 5
    },
    {
        "type": "condition",
        "condition": "confusion",
        "duration": 6,
        "stacks": 1
    }
],
    "castTimeMs": 1530,
    "quicknessCastTimeMs": 1020
  },
  [ID.FRIENDLY_FIRE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Friendly_Fire",
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "rifle"
    }
]
  },
  [ID.JOURNEY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 5,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Journey",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "rifle"
    }
]
  },
  [ID.INSPIRING_IMAGERY]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Inspiring_Imagery",
    "effects": []
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 20,
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Sharpshooter",
    "effects": [
    {
        "type": "strike",
        "coefficient": 2.28,
        "hits": 1,
        "name": "Phantasm shot",
        "actorType": "phantasm",
        "weapon": "rifle"
    }
],
  },
  [ID.SINGULARITY_SHOT]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Singularity_Shot",
    "effects": []
  },
  [ID.PHANTASMAL_LANCER]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 12,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Lancer",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Mesmer attack",
        "actorType": "player",
        "weapon": "spear"
    },
    {
        "type": "strike",
        "coefficient": 1.23,
        "hits": 1,
        "name": "One lancer",
        "actorType": "phantasm",
        "weapon": "spear"
    }
],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
  },
  [ID.MENTAL_COLLAPSE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mental_Collapse",
    "effects": [
    {
        "type": "strike",
        "coefficient": 3,
        "hits": 3,
        "name": "Damage",
        "actorType": "player",
        "weapon": "spear"
    }
]
  },
  [ID.PSYSTRIKE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Psystrike",
    "chainRoot": 73154,
    "chainStep": 2,
    "nextChainId": 73095,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "spear"
    }
]
  },
  [ID.MIND_THE_GAP]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 5,
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_the_Gap",
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.92,
        "hits": 1,
        "name": "Outer-edge damage",
        "actorType": "player",
        "weapon": "spear"
    }
],
  },
  [ID.MIND_PIERCE]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Pierce",
    "chainRoot": 73154,
    "chainStep": 3,
    "nextChainId": null,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.5,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "spear"
    }
]
  },
  [ID.IMAGINARY_INVERSION]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 10,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Imaginary_Inversion",
    "effects": [
    {
        "type": "strike",
        "coefficient": 2.4,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "spear"
    }
]
  },
  [ID.PSYCUT]: {
    "implemented": true,
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Psycut",
    "chainRoot": 73154,
    "chainStep": 1,
    "nextChainId": 73066,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "spear"
    }
],
    "castTimeMs": 930,
    "quicknessCastTimeMs": 620
  },
  [ID.LIVELY_LUTE]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lively_Lute",
    "effects": []
  },
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 4,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Honorable_Rogue",
    "effects": []
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    "implemented": true,
    "type": "Heal",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 15,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Second_Scion",
    "effects": []
  },
  [ID.FLUSTERING_FLUTE]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Flustering_Flute",
    "effects": []
  },
  [ID.TALE_OF_THE_SOULKEEPER]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Soulkeeper",
    "effects": []
  },
  [ID.CRESCENDO]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 1250,
    "quicknessCastTimeMs": 833.333333333,
    "cooldown": 35,
    "baseCoefficient": 2.25,
    "instrumentDamageIncrease": 0.25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Crescendo",
    "effects": []
  },
  [ID.HARMONIOUS_HARP]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 2000,
    "quicknessCastTimeMs": 1333.333333333,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Harmonious_Harp",
    "effects": []
  },
  [ID.TALE_OF_THE_AUGUST_QUEEN]: {
    "implemented": true,
    "type": "Elite",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 75,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_August_Queen",
    "effects": []
  },
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Tortured_Mastermind",
    "effects": [
    {
        "type": "strike",
        "coefficient": 4,
        "hits": 4,
        "name": "Damage",
        "actorType": "player",
        "weapon": "utility"
    },
    {
        "type": "condition",
        "condition": "torment",
        "duration": 8,
        "stacks": 1
    }
],
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 2000,
    "quicknessCastTimeMs": 1333.333333333,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Harmonious_Harp",
    "effects": []
  },
  [ID.DEAFENING_DRUM]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 25,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Deafening_Drum",
    "effects": []
  },
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: {
    "implemented": true,
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 30,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Valiant_Marshal",
    "effects": []
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    "implemented": true,
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "castTimeMs": 500,
    "quicknessCastTimeMs": 333.333333333,
    "cooldown": 12,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lively_Lute",
    "effects": []
  },
});

export const MESMER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(MESMER_SKILL_MECHANICS).map(Number),
);

export const MESMER_EXTRA_SKILLS = Object.freeze([
  Object.freeze({ id: ID.IMAGINARY_AXES, ...{
    "name": "Imaginary Axes",
    "description": "Ambush. Release phantasmal axes that seek out the nearest target after a short delay.",
    "icon": "https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png",
    "type": "Weapon",
    "weapon": "Axe",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 780,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Imaginary_Axes",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.PHANTOM_RAZOR, ...{
    "name": "Phantom Razor",
    "description": "Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.",
    "icon": "https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png",
    "type": "Weapon",
    "weapon": "Dagger",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantom_Razor",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.SPLIT_SURGE, ...{
    "name": "Split Surge",
    "description": "Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.",
    "icon": "https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png",
    "type": "Weapon",
    "weapon": "Greatsword",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1500,
    "cooldown": 0.5,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Split_Surge",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.EFFERVESCENCE, ...{
    "name": "Effervescence",
    "description": "Ambush. Spray invigorating magic, damaging enemies and healing allies.",
    "icon": "https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png",
    "type": "Weapon",
    "weapon": "Rifle",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 250,
    "quicknessCastTimeMs": 166.666666667,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Effervescence",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.ETHER_BARRAGE, ...{
    "name": "Ether Barrage",
    "description": "Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment. Condition duration is halved for clones.",
    "icon": "https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png",
    "type": "Weapon",
    "weapon": "Scepter",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Barrage",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.FRACTURED_GLASS, ...{
    "name": "Fractured Glass",
    "description": "Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.",
    "icon": "https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png",
    "type": "Weapon",
    "weapon": "Spear",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Fractured_Glass",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.CHAOS_VORTEX, ...{
    "name": "Chaos Vortex",
    "description": "Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.",
    "icon": "https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png",
    "type": "Weapon",
    "weapon": "Staff",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 1000,
    "quicknessCastTimeMs": 666.666666667,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Chaos_Vortex",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.MIRAGE_THRUST, ...{
    "name": "Mirage Thrust",
    "description": "Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.",
    "icon": "https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png",
    "type": "Weapon",
    "weapon": "Sword",
    "slot": "Weapon_1",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "castTimeMs": 750,
    "quicknessCastTimeMs": 500,
    "cooldown": 1,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "ambush": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirage_Thrust",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.COUNTERSPELL, ...{
    "name": "Counterspell",
    "description": "Flip skill for Illusionary Counter. Fire a blinding bolt, inflict confusion, and summon one clone on hit.",
    "icon": "https://render.guildwars2.com/file/33B7ADCA30B5EF4C1B52F71F39596FDEE9ECD8EB/103776.png",
    "type": "Weapon",
    "weapon": "Scepter",
    "slot": "Weapon_2",
    "environment": "Terrestrial",
    "castTimeMs": 900,
    "cooldown": 0,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "flipParent": "Illusionary Counter",
    "flipDuration": 2,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Counterspell",
    "implemented": true,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1,
        "name": "Projectile",
        "actorType": "player",
        "weapon": "scepter"
    },
    {
        "type": "condition",
        "condition": "Confusion",
        "duration": 7,
        "stacks": 5
    }
]
  } }),
  Object.freeze({ id: ID.POWER_SPIKE, ...{
    "name": "Power Spike",
    "description": "Mantra. Damage your target. Opens the bench with two charges and reverts to Mantra of Pain once both are spent.",
    "icon": "https://render.guildwars2.com/file/3519C5C770CCEAF92926D9495999E1F8A23D5AF3/103743.png",
    "type": "Utility",
    "weapon": "",
    "slot": "Utility",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 10,
    "resource": null,
    "blade": false,
    "flipParent": "Mantra of Pain",
    "ammo": 2,
    "armedAtStart": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Power_Spike",
    "implemented": true,
    "effects": [
    {
        "type": "strike",
        "coefficient": 1.33,
        "hits": 1,
        "name": "Damage",
        "actorType": "player"
    }
]
  } }),
  Object.freeze({ id: ID.DIMENSIONAL_APERTURE, ...{
    "name": "Dimensional Aperture",
    "description": "Collapse your singularity into a single-use portal and increase Singularity Shot's recharge by 50%.",
    "icon": "https://render.guildwars2.com/file/4342CE56CCFF5669FE084891F377B95D1026AFA1/3256364.png",
    "type": "Weapon",
    "weapon": "Rifle",
    "slot": "Weapon_5",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "flipParent": "Singularity Shot",
    "flipDuration": 3,
    "flipDelay": 0,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Dimensional_Aperture",
    "parentCooldownIncrease": 0.5,
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.ABSTRACTION, ...{
    "name": "Abstraction",
    "description": "Detonate your beacon, damaging and debilitating enemies while bolstering allies.",
    "icon": "https://render.guildwars2.com/file/72E5ACDEAE7571B67F96F9BDA8A271CCCF08957B/3256361.png",
    "type": "Weapon",
    "weapon": "Rifle",
    "slot": "Weapon_3",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "flipParent": "Inspiring Imagery",
    "flipDuration": 2,
    "flipDelay": 0,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Abstraction",
    "implemented": true,
    "effects": [
    {
        "type": "strike",
        "coefficient": 2.5,
        "hits": 1,
        "name": "Detonation",
        "actorType": "player",
        "weapon": "rifle"
    }
]
  } }),
  Object.freeze({ id: ID.INTO_THE_VOID, ...{
    "name": "Into the Void",
    "description": "Shatter your Temporal Curtain, pulling nearby enemies toward its position.",
    "icon": "https://render.guildwars2.com/file/E4D0E740C1700E3ACFBBD25D7F0C0628E0204559/103758.png",
    "type": "Weapon",
    "weapon": "Focus",
    "slot": "Weapon_4",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "flipParent": "Temporal Curtain",
    "flipDuration": 5,
    "flipDelay": 1,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Into_the_Void",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.COUNTER_BLADE, ...{
    "name": "Counter Blade",
    "description": "Shoot a bolt that damages and dazes foes in a line.",
    "icon": "https://render.guildwars2.com/file/7ADC0ABCDBA004A5DE085096300DA2B9C191C84C/103792.png",
    "type": "Weapon",
    "weapon": "Sword",
    "slot": "Weapon_4",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 1020,
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "flipParent": "Illusionary Riposte",
    "flipDuration": 3,
    "flipDelay": 0,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Counter_Blade",
    "implemented": true,
    "effects": [
    {
        "type": "strike",
        "coefficient": 0.1,
        "hits": 1,
        "name": "Damage",
        "actorType": "player",
        "weapon": "sword"
    }
]
  } }),
  Object.freeze({ id: ID.SWAP, ...{
    "name": "Swap",
    "description": "Swap places with your clone and immobilize nearby foes.",
    "icon": "https://render.guildwars2.com/file/BEDBA7E72F06AA51D124B9B29EA53D4E3FEAFA48/103728.png",
    "type": "Weapon",
    "weapon": "Sword",
    "slot": "Weapon_3",
    "specialization": "",
    "environment": "Terrestrial",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "flipParent": "Illusionary Leap",
    "flipDuration": 5,
    "flipDelay": 0,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Swap",
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.DODGE_MIRAGE_CLOAK, ...{
    "name": "Dodge / Mirage Cloak",
    "description": "Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.",
    "icon": "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 10,
    "ammo": 2,
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.SWAP_WEAPONS, ...{
    "name": "Swap Weapons",
    "description": "Swap between weapon sets. The swap has a 10-second recharge.",
    "icon": "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 10,
    "implemented": true,
    "effects": []
  } }),
  Object.freeze({ id: ID.CONTINUUM_SHIFT, ...{
    "name": "Continuum Shift",
    "description": "End Continuum Split early and restore the cooldown state captured when the split began.",
    "icon": "https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png",
    "type": "Action",
    "slot": "Action",
    "castTimeMs": 0,
    "rechargeAnchor": "castStart",
    "cooldown": 0,
    "specialization": "Chronomancer",
    "implemented": true,
    "effects": []
  } }),
]);

export const AMBUSH_SKILLS = Object.freeze(MESMER_EXTRA_SKILLS.slice(0, 8));
export const PSEUDO_SKILLS = Object.freeze(MESMER_EXTRA_SKILLS.slice(8));

// Illusion, ambush, phantasm, shatter, trait, and instrument formulas.
/**
 * Mesmer illusion data: weapon coefficients, clone/ambush/phantasm attacks, and timings.
 * - WEAPON_STRENGTH: Base damage multiplier by weapon type (lower = weaker).
 * - CLONE_ATTACKS: Auto-attack pattern (interval, coefficient, conditions per weapon).
 * - AMBUSH_ATTACKS: Mirage weapon-skill replacements granted by Mirage Cloak.
 * - PHANTASM_ATTACK_TIMINGS: Phantasm cast + damage + spawn times (measured from skill start).
 * - PHANTASM_NAME_BY_SKILL: Maps summoning skills to phantasm names.
 */

/** Base damage multiplier per weapon type. Determines strike damage output with fixed stats. */
export const WEAPON_STRENGTH = {
  Axe: 1000,
  Dagger: 1000,
  Focus: 900,
  Greatsword: 1100,
  Hammer: 1100,
  Pistol: 1000,
  Rifle: 1150,
  Scepter: 1000,
  Shield: 900,
  Spear: 1000,
  Staff: 1100,
  Sword: 1000,
  Torch: 900,
  Trident: 1000,
  Utility: 690.5,
  Unequipped: 690.5,
  "Phantasm high": 2877,
  "Phantasm medium": 2615.5,
  "Phantasm defender": 2362.5,
};

/**
 * Clone auto-attack patterns by weapon: coefficient, hits, interval (seconds), weaponStrength, conditions.
 * Interval: time between successive attacks. Conditions applied on each attack.
 */
export const CLONE_ATTACKS = {
  Axe: {
    weaponStrength: 28.5,
    sequence: [
      {
        name: "Clone: Lacerating Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.51,
        conditions: [{ name: "Bleeding", duration: 2, stacks: 1 }],
      },
      {
        name: "Clone: Ethereal Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.61,
        conditions: [{ name: "Torment", duration: 2, stacks: 1 }],
      },
      {
        name: "Clone: Mirror Strikes",
        coefficient: 1.1,
        hits: 2,
        interval: 1.17,
        conditions: [
          { name: "Bleeding", duration: 6, stacks: 1 },
          { name: "Torment", duration: 6, stacks: 1 },
        ],
      },
    ],
  },
  Dagger: {
    name: "Clone: Flying Cutter",
    coefficient: 0.7,
    hits: 1,
    interval: 0.68,
    weaponStrength: 26.5,
  },
  Greatsword: {
    coefficient: 1.1,
    hits: 3,
    interval: 1.5,
    weaponStrength: 26.5,
  },
  Rifle: { coefficient: 0.5, hits: 1, interval: 1.2, weaponStrength: 26.5 },
  Scepter: {
    name: "Clone: Ether Bolt",
    coefficient: 0.3,
    hits: 1,
    interval: 2,
    weaponStrength: 34,
    conditions: [{ name: "Torment", duration: 4, stacks: 1 }],
  },
  Spear: {
    weaponStrength: 26.3,
    sequence: [
      {
        name: "Clone: Psycut",
        coefficient: 1,
        hits: 1,
        interval: 0.93,
      },
      {
        name: "Clone: Psystrike",
        coefficient: 1,
        hits: 1,
        interval: 0.5,
      },
      {
        name: "Clone: Mind Pierce",
        coefficient: 1.5,
        hits: 1,
        interval: 0.75,
      },
    ],
  },
  Staff: {
    name: "Clone: Winds of Chaos",
    coefficient: 0.49,
    // A completed clone cast bounces through the target twice. The conditions
    // apply once per cast, while both bounces can strike and critically hit.
    hits: 2,
    firstAttackDelay: 1.12,
    interval: 2.24,
    weaponStrength: 26,
    conditions: [
      { name: "Torment", duration: 2, stacks: 1 },
      { name: "Confusion", duration: 2, stacks: 1 },
    ],
  },
  Sword: {
    weaponStrength: 20.5,
    firstAttackDelay: 2.48,
    sequence: [
      {
        name: "Clone: Mind Slash",
        coefficient: 0.75,
        hits: 1,
        interval: 2.48 / 3,
      },
      {
        name: "Clone: Mind Gash",
        coefficient: 0.75,
        hits: 1,
        interval: 2.48 / 3,
      },
      {
        name: "Clone: Mind Stab",
        coefficient: 0.12,
        hits: 1,
        interval: 2.48 / 3,
      },
    ],
  },
};

/**
 * Mirage Ambush attacks. Player and clone values differ for several weapons,
 * so both variants are kept explicitly. Coefficients are totals across all
 * hits, matching the scheduler's damage-group format.
 */
export const AMBUSH_ATTACKS = {
  Axe: {
    id: 44321,
    name: "Imaginary Axes",
    icon:
      "https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png",
    description:
      "Ambush. Release phantasmal axes that seek out the nearest target after a short delay.",
    castTimeMs: 780,
    cooldown: 1,
    player: {
      coefficient: 1,
      hits: 2,
      conditions: [{ name: "Torment", duration: 3.5, stacks: 3 }],
    },
    clone: {
      coefficient: 3.7,
      hits: 2,
      castTimeMs: 1110,
      conditions: [{ name: "Torment", duration: 4, stacks: 1 }],
    },
  },
  Dagger: {
    id: 69389,
    name: "Phantom Razor",
    icon:
      "https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png",
    description:
      "Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.",
    castTimeMs: 750,
    cooldown: 1,
    player: {
      coefficient: 3,
      hits: 3,
      conditions: [
        { name: "Bleeding", duration: 5, stacks: 2 },
        { name: "Torment", duration: 5, stacks: 2 },
      ],
    },
    clone: {
      coefficient: 3,
      hits: 3,
      castTimeMs: 0,
      conditions: [
        { name: "Bleeding", duration: 7, stacks: 1 },
        { name: "Torment", duration: 7, stacks: 1 },
      ],
    },
  },
  Greatsword: {
    id: 44241,
    name: "Split Surge",
    icon:
      "https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png",
    description:
      "Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.",
    castTimeMs: 1500,
    cooldown: 0.5,
    player: { coefficient: 3.19, hits: 3 },
    clone: { coefficient: 3.1875, hits: 3 },
    playerBoons: [{ name: "Might", duration: 5, stacks: 6 }],
    vulnerability: { duration: 5, stacks: 6 },
  },
  Rifle: {
    id: 71800,
    name: "Effervescence",
    icon:
      "https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png",
    description:
      "Ambush. Spray invigorating magic, damaging enemies and healing allies.",
    castTimeMs: 250,
    cooldown: 1,
    player: { coefficient: 2.6, hits: 4 },
    clone: { coefficient: 1.2, hits: 4 },
    playerBoons: [{ name: "Vigor", duration: 4, stacks: 1 }],
  },
  Scepter: {
    id: 42304,
    name: "Ether Barrage",
    icon:
      "https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png",
    description:
      "Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment. Condition duration is halved for clones.",
    castTimeMs: 1500,
    cooldown: 1,
    player: {
      coefficient: 1.25,
      hits: 5,
      conditions: [
        { name: "Confusion", duration: 4, stacks: 2 },
        { name: "Torment", duration: 4, stacks: 3 },
      ],
    },
    clone: {
      coefficient: 3.75,
      hits: 5,
      conditions: [
        { name: "Confusion", duration: 2, stacks: 2 },
        { name: "Torment", duration: 2, stacks: 3 },
      ],
    },
  },
  Spear: {
    id: 73067,
    name: "Fractured Glass",
    icon:
      "https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png",
    description:
      "Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.",
    castTimeMs: 1000,
    cooldown: 1,
    player: { coefficient: 3.15, hits: 7 },
    clone: { coefficient: 3.15, hits: 7 },
    vulnerability: { duration: 6, stacks: 7 },
  },
  Staff: {
    id: 40184,
    name: "Chaos Vortex",
    icon:
      "https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png",
    description:
      "Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.",
    castTimeMs: 1000,
    cooldown: 1,
    player: {
      coefficient: 0.6,
      hits: 1,
      conditions: [
        { name: "Bleeding", duration: 10, stacks: 1 },
        { name: "Torment", duration: 10, stacks: 1 },
        { name: "Confusion", duration: 10, stacks: 1 },
      ],
    },
    clone: {
      coefficient: 1.12,
      hits: 1,
      conditions: [
        { name: "Bleeding", duration: 4, stacks: 1 },
        { name: "Torment", duration: 4, stacks: 1 },
        { name: "Confusion", duration: 3, stacks: 1 },
      ],
    },
    playerBoons: [
      { name: "Might", duration: 15, stacks: 2 },
      { name: "Fury", duration: 2, stacks: 1 },
    ],
    cloneBoons: [
      { name: "Might", duration: 15, stacks: 2 },
      { name: "Fury", duration: 2, stacks: 1 },
    ],
  },
  Sword: {
    id: 45230,
    name: "Mirage Thrust",
    icon:
      "https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png",
    description:
      "Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.",
    castTimeMs: 750,
    cooldown: 1,
    player: { coefficient: 3, hits: 1 },
    clone: { coefficient: 3, hits: 1 },
    createsClone: true,
    control: true,
  },
};

// Measured from the start of the player's cast. `damage` is when the phantasm
// has dealt all of its damage and `spawn` is when it becomes a clone. The
// Chronophantasma values include the repeated attack. Echo of Memory summons
// the phantasm named Phantasmal Avenger.
export const PHANTASM_ATTACK_TIMINGS = Object.freeze({
  "Phantasmal Avenger": {
    castTimeMs: 1640,
    damageAtMs: 1440,
    spawnAtMs: 2160,
    chronophantasmaDamageAtMs: 4200,
    chronophantasmaSpawnAtMs: 4960,
  },
  "Phantasmal Berserker": {
    castTimeMs: 560,
    damageAtMs: 1480,
    spawnAtMs: 2560,
    chronophantasmaDamageAtMs: 4680,
    chronophantasmaSpawnAtMs: 5920,
    // Virtuoso stocks Bountiful Blades' two blades independently when each
    // Phantasmal Blade projectile arrives, rather than batching both at the
    // clone-conversion endpoint.
    virtuosoBladeTicks: [
    { atMs: 3120 },
    { atMs: 3440 }
],
  },
  "Phantasmal Defender": {
    castTimeMs: 770,
    damageAtMs: 3800,
    spawnAtMs: 4510,
    chronophantasmaDamageAtMs: 8800,
    chronophantasmaSpawnAtMs: 9520,
  },
  "Phantasmal Disenchanter": {
    castTimeMs: 760,
    damageAtMs: 1150,
    spawnAtMs: 1840,
    chronophantasmaDamageAtMs: 4040,
    chronophantasmaSpawnAtMs: 4720,
  },
  "Phantasmal Duelist": {
    castTimeMs: 560,
    damageAtMs: 2751,
    spawnAtMs: 3334,
    chronophantasmaDamageAtMs: 6440,
    chronophantasmaSpawnAtMs: 7040,
    damageTicks: {
      "Illusion Damage": [
    { atMs: 1351 },
    { atMs: 1551 },
    { atMs: 1750 },
    { atMs: 1950 },
    { atMs: 2151 },
    { atMs: 2350 },
    { atMs: 2550 },
    { atMs: 2751 }
],
    },
    phantasmalBladeDelayAfterSpawnMs: 175,
  },
  "Phantasmal Mage": {
    castTimeMs: 800,
    damageAtMs: 2270,
    spawnAtMs: 2520,
    chronophantasmaDamageAtMs: 5320,
    chronophantasmaSpawnAtMs: 5560,
  },
  "Phantasmal Rogue": {
    castTimeMs: 610,
    damageAtMs: 1200,
    spawnAtMs: 2000,
    chronophantasmaDamageAtMs: 4040,
    chronophantasmaSpawnAtMs: 4760,
  },
  "Phantasmal Swordsman": {
    castTimeMs: 880,
    damageAtMs: 3159,
    spawnAtMs: 4284,
    chronophantasmaDamageAtMs: 7120,
    chronophantasmaSpawnAtMs: 8270,
    damageTicks: {
      "Phantasm leap": [
    { atMs: 1725 }
],
      "Phantasm Blurred Frenzy": [
    { atMs: 2201 },
    { atMs: 2242 },
    { atMs: 2525 },
    { atMs: 2559 },
    { atMs: 2800 },
    { atMs: 2842 },
    { atMs: 3126 },
    { atMs: 3159 }
],
    },
    phantasmalBladeDelayAfterSpawnMs: 83,
  },
  "Phantasmal Warden": {
    castTimeMs: 460,
    damageAtMs: 5040,
    spawnAtMs: 7240,
    chronophantasmaDamageAtMs: 13200,
    chronophantasmaSpawnAtMs: 15320,
  },
  "Phantasmal Warlock": {
    castTimeMs: 780,
    damageAtMs: 2960,
    spawnAtMs: 4240,
    chronophantasmaDamageAtMs: 8560,
    chronophantasmaSpawnAtMs: 9840,
  },
  // These post-table weapon phantasms retain explicit estimates.
  "Phantasmal Sharpshooter": {
    castTimeMs: 500,
    damageAtMs: 1550,
    spawnAtMs: 1550,
    chronophantasmaDamageAtMs: 2600,
    chronophantasmaSpawnAtMs: 2600,
    estimated: true,
  },
  "Phantasmal Lancer": {
    castTimeMs: 333.333333333,
    damageAtMs: 1083.3333333,
    spawnAtMs: 1083.3333333,
    chronophantasmaDamageAtMs: 1833.3333333,
    chronophantasmaSpawnAtMs: 1833.3333333,
    estimated: true,
  },
});

export const PHANTASM_NAME_BY_SKILL = Object.freeze({
  "Echo of Memory": "Phantasmal Avenger",
});

/**
 * Mesmer profession data: condition formulas, shatter types, skill classifications, and instruments.
 * - CONDITION_FORMULAS: Damage per tick by condition (base + scaling per condition damage stat).
 * - SHATTERS: Shatter skills (Mind Wrack, Cry of Frustration, etc.) with slot and damage type.
 * - CONTROL_SKILLS: Skills that disable target (stun/daze/knockdown).
 * - BLIND_SKILLS: Skills that blind primary target.
 * - ARISTOCRACY_SKILLS: Skills triggering Aristocracy relic (Weakness/Vulnerability).
 * - PEITHA_SKILLS: Skills triggering Peitha relic (movement/displacement).
 * - INSTRUMENTS: Troubadour instruments (Lute, Flute, Drum, Harp) with damage/conditions.
 * - MECHANIC_SKILLS: Profession-specific mechanic skills (Shatters, Instruments, Signets).
 */

/** Condition tick damage formula: base + (condition damage × scaling factor). */
export { CONDITION_FORMULAS } from "../../../platform/gw2/condition-formulas.js";

export const TRAIT_DAMAGE = Object.freeze({
  "Lesser Chaos Storm": {
    coefficient: 1.98,
    hits: 6,
    interval: 1,
    cooldown: 28,
  },
  "Phantasmal Blade": {
    coefficient: 0.7,
    hits: 1,
    weaponStrength: 2553.5,
  },
  Syncopate: {
    coefficient: 0.75,
    hits: 1,
  },
  "Time Bomb": {
    coefficient: 3,
    hits: 1,
    duration: 5,
    damageIncrease: 0.1,
  },
});

export const SHATTERS = {
  "Mind Wrack": {
    slot: 1,
    kind: "core-power",
    coefficients: [0.81, 1.61, 2.42, 3.22],
  },
  "Cry of Frustration": {
    slot: 2,
    kind: "core-confusion",
    coefficients: [0.42, 0.84, 1.25, 1.67],
  },
  Diversion: { slot: 3, kind: "control", coefficients: [0, 0, 0, 0] },
  Distortion: { slot: 4, kind: "defense", coefficients: [0, 0, 0, 0] },
  "Split Second": {
    slot: 1,
    kind: "chrono-power",
    coefficients: [1.534, 3.22, 3.86, 4.51],
  },
  Rewinder: {
    slot: 2,
    kind: "chrono-confusion",
    coefficients: [0.42, 0.84, 1.25, 1.67],
  },
  "Time Sink": { slot: 3, kind: "control", coefficients: [0, 0, 0, 0] },
  "Bladesong Harmony": {
    slot: 1,
    kind: "blade-power",
    coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
    resourceSpendProgress: 1,
    packetDelays: [0.05, 0.208, 0.367, 0.534, 0.684],
  },
  "Bladesong Sorrow": {
    slot: 2,
    kind: "blade-confusion",
    coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
    resourceSpendProgress: 1,
    packetDelays: [0.442, 0.517, 0.601, 0.675, 0.675],
  },
  "Bladesong Dissonance": {
    slot: 3,
    kind: "blade-control",
    coefficients: [0, 1, 1, 1, 1, 1],
    resourceSpendProgress: 1,
  },
  "Bladesong Distortion": {
    slot: 4,
    kind: "blade-defense",
    coefficients: [0, 0, 0, 0, 0, 0],
  },
  "Bladeturn Requiem": {
    slot: 5,
    kind: "blade-requiem",
    coefficients: [0, 0.5, 1, 1.5, 2, 2.5],
    resourceSpendProgress: 1,
    packetDelays: [1, 2, 3, 4, 5],
  },
  "Continuum Split": {
    slot: 5,
    kind: "continuum",
    coefficients: [0, 0, 0, 0],
  },
};

// Skills whose modeled hit disables the benchmark target. Keep this explicit:
// descriptions also mention incoming disables and conditional defiance damage,
// neither of which should activate Relic of the Claw.
export const CONTROL_SKILLS = new Set([
  "Chaos Storm",
  "Illusionary Wave",
  "Magic Bullet",
  "Signet of Domination",
  "Vortex",
  "Illusion of Drowning",
  "Phantasmal Defender",
  "Signet of Humility",
  "Tides of Time",
  "Gravity Well",
  "Mirage Advance",
  "Phantasmal Sharpshooter",
  "Flustering Flute",
  "Deafening Drum",
  "Diversion",
  "Time Sink",
  "Bladesong Dissonance",
  "Into the Void",
  "Counter Blade",
  "Mirage Thrust",
]);

// These skills blind the primary benchmark target directly. Magic Bullet is
// excluded because its blind applies only to the third target in the bounce.
export const BLIND_SKILLS = new Set([
  "Counterspell",
  "Signet of Midnight",
  "Blinding Tide",
  "The Prestige",
  "Chaos Armor",
  "Mirage Advance",
]);

export const ARISTOCRACY_SKILLS = new Set([
  "Mind Slash",
  "Mind Gash",
  "Mind Pierce",
  "Blinding Tide",
  "Rain of Swords",
]);

export const PEITHA_SKILLS = new Set([
  "Blink",
  "Phase Retreat",
  "False Oasis",
  "Crystal Sands",
  "Mirage Advance",
  "Sand through Glass",
  "Illusionary Ambush",
  "Jaunt",
  "Axes of Symmetry",
]);

export const INSTRUMENTS = {
  "Lively Lute": {
    slot: 1,
    instrument: "Lute",
    coefficient: 3,
    hits: 3,
  },
  "Flustering Flute": {
    slot: 2,
    instrument: "Flute",
    coefficient: 1,
    hits: 1,
    conditions: [{ name: "Confusion", duration: 4, stacks: 3 }],
  },
  "Deafening Drum": {
    slot: 3,
    instrument: "Drum",
    coefficient: 2,
    hits: 1,
  },
  "Harmonious Harp": {
    slot: 4,
    instrument: "Harp",
    coefficient: 0,
    hits: 0,
  },
};

export const MECHANIC_SKILLS = {
  Core: ["Mind Wrack", "Cry of Frustration", "Diversion", "Distortion"],
  Chronomancer: [
    "Split Second",
    "Rewinder",
    "Time Sink",
    "Distortion",
    "Continuum Split",
  ],
  Mirage: ["Mind Wrack", "Cry of Frustration", "Diversion", "Distortion"],
  Virtuoso: [
    "Bladesong Harmony",
    "Bladesong Sorrow",
    "Bladesong Dissonance",
    "Bladesong Distortion",
    "Bladeturn Requiem",
  ],
  Troubadour: [
    "Lively Lute",
    "Flustering Flute",
    "Deafening Drum",
    "Harmonious Harp",
    "Crescendo",
  ],
};
