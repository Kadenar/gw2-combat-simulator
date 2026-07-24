/**
 * Simulator-owned base mechanics for generated catalog skills.
 *
 * Fields supplied by mesmer-skill-overrides.js are intentionally absent.
 * normalizedSkill() combines this data with catalog metadata and overrides.
 */

export const BASE_SKILL_DATA_BY_ID = {
  "10168": {
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 9,
    "damage": [
      {
        "coefficient": 5.32,
        "hits": 7,
        "label": "Damage",
        "source": "Player",
        "weapon": "scepter"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 7,
        "stacks": 7
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Confusing_Images"
  },
  "10169": {
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Chaos_Storm"
  },
  "10170": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "sword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Slash"
  },
  "10173": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.6,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 0.003,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "sword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Leap"
  },
  "10174": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 15,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Swordsman"
  },
  "10175": {
    "type": "Weapon",
    "weapon": "Pistol",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 16,
    "conditions": [
      {
        "name": "bleeding",
        "duration": 4,
        "stacks": 8
      }
    ],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Duelist"
  },
  "10176": {
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Feast"
  },
  "10177": {
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.25,
    "cooldown": 12,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror"
  },
  "10186": {
    "type": "Weapon",
    "weapon": "Focus",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.11,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Temporal_Curtain"
  },
  "10189": {
    "type": "Weapon",
    "weapon": "Torch",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "conditions": [
      {
        "name": "burning",
        "duration": 9,
        "stacks": 1
      },
      {
        "name": "confusion",
        "duration": 3,
        "stacks": 3
      }
    ],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Mage"
  },
  "10190": {
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 25,
    "damage": [
      {
        "coefficient": 0.38,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 3,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Cry_of_Frustration"
  },
  "10191": {
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 1.15,
        "hits": 1,
        "label": "1 Illusion",
        "source": "Phantasm",
        "weapon": "unequipped"
      },
      {
        "coefficient": 1.84,
        "hits": 2,
        "label": "2 Illusions",
        "source": "Phantasm",
        "weapon": "unequipped"
      },
      {
        "coefficient": 2.415,
        "hits": 3,
        "label": "3 Illusions",
        "source": "Phantasm",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Wrack"
  },
  "10192": {
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 50,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Distortion"
  },
  "10197": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 72,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Portal_Entre"
  },
  "10200": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blink"
  },
  "10201": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Decoy"
  },
  "10202": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 2
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror_Images"
  },
  "10203": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.25,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Null_Field"
  },
  "10211": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 2.25,
    "cooldown": 1,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mantra_of_Pain"
  },
  "10213": {
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 2.25,
    "cooldown": 10,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mantra_of_Recovery"
  },
  "10216": {
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
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Warlock"
  },
  "10218": {
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 10,
    "damage": [
      {
        "coefficient": 1.8,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "greatsword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_Stab"
  },
  "10219": {
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.125,
    "cooldown": 0,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Spatial_Surge"
  },
  "10220": {
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.96,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 0.3,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "greatsword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Wave"
  },
  "10221": {
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 12,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Berserker"
  },
  "10229": {
    "type": "Weapon",
    "weapon": "Pistol",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 0.2,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "pistol"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 5,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Magic_Bullet"
  },
  "10232": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.25,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Domination"
  },
  "10234": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Midnight"
  },
  "10236": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Inspiration"
  },
  "10245": {
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.25,
    "cooldown": 35,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mass_Invisibility"
  },
  "10247": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.68,
    "cooldown": 60,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Illusions"
  },
  "10258": {
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "activation": 0.5,
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 0.3,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "trident"
      }
    ],
    "conditions": [
      {
        "name": "bleeding",
        "duration": 1,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Siren's_Call"
  },
  "10259": {
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "activation": 0.5,
    "cooldown": 8,
    "damage": [
      {
        "coefficient": 0.8,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "trident"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blinding_Tide"
  },
  "10260": {
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "activation": 0.75,
    "cooldown": 25,
    "damage": [
      {
        "coefficient": 1.28,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "trident"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusion_of_Drowning"
  },
  "10267": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Disenchanter"
  },
  "10273": {
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 0.3,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "staff"
      }
    ],
    "conditions": [
      {
        "name": "torment",
        "duration": 5,
        "stacks": 1
      },
      {
        "name": "confusion",
        "duration": 5,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Winds_of_Chaos"
  },
  "10276": {
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 2,
    "cooldown": 6,
    "phantasm": false,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Counter"
  },
  "10280": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 2.25,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 2,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "sword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Riposte"
  },
  "10282": {
    "type": "Weapon",
    "weapon": "Focus",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 20,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Warden"
  },
  "10285": {
    "type": "Weapon",
    "weapon": "Torch",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "torch"
      }
    ],
    "conditions": [
      {
        "name": "burning",
        "duration": 9,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/The_Prestige"
  },
  "10287": {
    "type": "Profession",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 38,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Diversion"
  },
  "10289": {
    "type": "Weapon",
    "weapon": "Scepter",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 0.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "scepter"
      }
    ],
    "conditions": [
      {
        "name": "torment",
        "duration": 4,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Ether_Bolt"
  },
  "10302": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 32,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Feedback"
  },
  "10310": {
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 8,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phase_Retreat"
  },
  "10311": {
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.96,
    "cooldown": 120,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Time_Warp"
  },
  "10327": {
    "type": "Weapon",
    "weapon": "Trident",
    "specialization": "",
    "environment": "Aquatic",
    "activation": 0.75,
    "cooldown": 12,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Imminent_Voyage"
  },
  "10331": {
    "type": "Weapon",
    "weapon": "Staff",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 16,
    "damage": [],
    "conditions": [
      {
        "name": "confusion",
        "duration": 5,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Chaos_Armor"
  },
  "10333": {
    "type": "Weapon",
    "weapon": "Greatsword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.08,
    "cooldown": 5,
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirror_Blade"
  },
  "10334": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1.44,
    "cooldown": 10,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blurred_Frenzy"
  },
  "10341": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 40,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Defender"
  },
  "21750": {
    "type": "Heal",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 30,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_the_Ether"
  },
  "24755": {
    "type": "Elite",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 60,
    "damage": [
      {
        "coefficient": 5,
        "hits": 10,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Thousand_Cuts"
  },
  "29519": {
    "type": "Elite",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 1,
    "cooldown": 45,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Signet_of_Humility"
  },
  "29526": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 60,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Precognition"
  },
  "29578": {
    "type": "Utility",
    "weapon": "",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.25,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mimic"
  },
  "29830": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 105,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Continuum_Split"
  },
  "29856": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 1.14,
    "cooldown": 20,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Senility"
  },
  "30305": {
    "type": "Heal",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0.25,
    "cooldown": 30,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Eternity"
  },
  "30359": {
    "type": "Elite",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 1.56,
    "cooldown": 60,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Gravity_Well"
  },
  "30525": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 1.2,
    "cooldown": 20,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Calamity"
  },
  "30643": {
    "type": "Weapon",
    "weapon": "Shield",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 1.02,
    "cooldown": 35,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "shield"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tides_of_Time"
  },
  "30769": {
    "type": "Weapon",
    "weapon": "Shield",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "cooldown": 30,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Echo_of_Memory"
  },
  "30814": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 1.2,
    "cooldown": 20,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Well_of_Action"
  },
  "35637": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 25,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "utility"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Sword_of_Decimation"
  },
  "40200": {
    "type": "Heal",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 1.44,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/False_Oasis"
  },
  "41065": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 0.6,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 2.4,
        "hits": 6,
        "label": "Damage",
        "source": "Player",
        "weapon": "utility"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 4,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Crystal_Sands"
  },
  "42851": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 25,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "utility"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mirage_Advance"
  },
  "43064": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Sand_through_Glass"
  },
  "43343": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 2,
    "cooldown": 35,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "fill",
      "count": 5
    },
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blade_Renewal"
  },
  "43761": {
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 8,
    "damage": [
      {
        "coefficient": 1.75,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "axe"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 6,
        "stacks": 5
      },
      {
        "name": "confusion",
        "duration": 6,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Axes_of_Symmetry"
  },
  "44791": {
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 0.55,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "axe"
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lacerating_Chop"
  },
  "45046": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Illusionary_Ambush"
  },
  "45243": {
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "cooldown": 0.25,
    "damage": [
      {
        "coefficient": 1.2,
        "hits": 3,
        "label": "Damage",
        "source": "Player",
        "weapon": "axe"
      }
    ],
    "conditions": [
      {
        "name": "torment",
        "duration": 4,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lingering_Thoughts"
  },
  "45425": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 1.02,
    "cooldown": 25,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Rain_of_Swords"
  },
  "45449": {
    "type": "Elite",
    "weapon": "",
    "specialization": "Mirage",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 0.5,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "utility"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 6,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Jaunt"
  },
  "56873": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 38,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Time_Sink"
  },
  "56928": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 30,
    "damage": [
      {
        "coefficient": 0.38,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 3,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Rewinder"
  },
  "56930": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Chronomancer",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 0.767,
        "hits": 1,
        "label": "1 Clone",
        "source": "Player",
        "weapon": ""
      },
      {
        "coefficient": 1.226,
        "hits": 2,
        "label": "2 Clones",
        "source": "Player",
        "weapon": ""
      },
      {
        "coefficient": 1.6110000000000002,
        "hits": 3,
        "label": "3 Clones",
        "source": "Player",
        "weapon": ""
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Split_Second"
  },
  "62510": {
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.66,
    "cooldown": 0,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Flying_Cutter"
  },
  "62522": {
    "type": "Heal",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 1,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 0.7,
        "hits": 2,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Twin_Blade_Restoration"
  },
  "62560": {
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 5,
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladecall"
  },
  "62568": {
    "type": "Weapon",
    "weapon": "Sword",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "sword"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Blade_Leap"
  },
  "62573": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 3,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "utility"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Psychic_Force"
  },
  "62597": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 30,
    "damage": [
      {
        "coefficient": 0.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladeturn_Requiem"
  },
  "62602": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.72,
    "cooldown": 30,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Dissonance"
  },
  "62607": {
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.66,
    "cooldown": 12,
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Unstable_Bladestorm"
  },
  "62616": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.72,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 0.38,
        "hits": 1,
        "label": "Strike Damage per Blade Spent",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 3,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Sorrow"
  },
  "62617": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0.96,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 0.7,
        "hits": 1,
        "label": "Strike Damage per Blade Spent",
        "source": "Player",
        "weapon": "unequipped"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Harmony"
  },
  "68273": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Virtuoso",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 50,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": true,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladesong_Distortion"
  },
  "69311": {
    "type": "Weapon",
    "weapon": "Dagger",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 5,
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Bladecall"
  },
  "69344": {
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 0.25,
    "damage": [
      {
        "coefficient": 1.2,
        "hits": 3,
        "label": "Damage",
        "source": "Player",
        "weapon": "axe"
      }
    ],
    "conditions": [
      {
        "name": "torment",
        "duration": 4,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lingering_Thoughts"
  },
  "69385": {
    "type": "Weapon",
    "weapon": "Axe",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "cooldown": 8,
    "damage": [
      {
        "coefficient": 1.75,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "axe"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 6,
        "stacks": 5
      },
      {
        "name": "confusion",
        "duration": 6,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Axes_of_Symmetry"
  },
  "71892": {
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 0.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "rifle"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Friendly_Fire"
  },
  "71897": {
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 5,
    "damage": [
      {
        "coefficient": 1.5,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "rifle"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Journey"
  },
  "72005": {
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 12,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Inspiring_Imagery"
  },
  "72007": {
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 20,
    "conditions": [],
    "phantasm": true,
    "resource": {
      "mode": "phantasm",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Sharpshooter"
  },
  "72008": {
    "type": "Weapon",
    "weapon": "Rifle",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Singularity_Shot"
  },
  "72946": {
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 12,
    "conditions": [],
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Phantasmal_Lancer"
  },
  "72957": {
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 3,
        "hits": 3,
        "label": "Damage",
        "source": "Player",
        "weapon": "spear"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mental_Collapse"
  },
  "73093": {
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 5,
    "conditions": [],
    "phantasm": false,
    "resource": {
      "mode": "add",
      "count": 1
    },
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Mind_the_Gap"
  },
  "73152": {
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "activation": 0.75,
    "cooldown": 10,
    "damage": [
      {
        "coefficient": 2.4,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "spear"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Imaginary_Inversion"
  },
  "73154": {
    "type": "Weapon",
    "weapon": "Spear",
    "specialization": "",
    "environment": "Terrestrial",
    "cooldown": 0,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "spear"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Psycut"
  },
  "76552": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 3,
        "hits": 3,
        "label": "Damage",
        "source": "Player",
        "weapon": ""
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lively_Lute"
  },
  "76611": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 4,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Honorable_Rogue"
  },
  "76695": {
    "type": "Heal",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 1,
    "cooldown": 15,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Second_Scion"
  },
  "76746": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 20,
    "damage": [
      {
        "coefficient": 1,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "hammer"
      }
    ],
    "conditions": [
      {
        "name": "confusion",
        "duration": 4,
        "stacks": 3
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Flustering_Flute"
  },
  "76850": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 20,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Soulkeeper"
  },
  "76931": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 1.25,
    "cooldown": 35,
    "damage": [
      {
        "coefficient": 2.25,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "hammer"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Crescendo"
  },
  "76960": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 2,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Harmonious_Harp"
  },
  "76971": {
    "type": "Elite",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 1,
    "cooldown": 75,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_August_Queen"
  },
  "77066": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 20,
    "conditions": [
      {
        "name": "torment",
        "duration": 8,
        "stacks": 1
      }
    ],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Tortured_Mastermind"
  },
  "77077": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 2,
    "cooldown": 25,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Harmonious_Harp"
  },
  "77079": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.25,
    "cooldown": 25,
    "damage": [
      {
        "coefficient": 2,
        "hits": 1,
        "label": "Damage",
        "source": "Player",
        "weapon": "hammer"
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Deafening_Drum"
  },
  "77178": {
    "type": "Utility",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0,
    "cooldown": 30,
    "damage": [],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Tale_of_the_Valiant_Marshal"
  },
  "77306": {
    "type": "Profession",
    "weapon": "",
    "specialization": "Troubadour",
    "environment": "Terrestrial",
    "activation": 0.5,
    "cooldown": 12,
    "damage": [
      {
        "coefficient": 3,
        "hits": 3,
        "label": "Damage",
        "source": "Player",
        "weapon": ""
      }
    ],
    "conditions": [],
    "phantasm": false,
    "resource": null,
    "blade": false,
    "wikiUrl": "https://wiki.guildwars2.com/wiki/Lively_Lute"
  }
};
