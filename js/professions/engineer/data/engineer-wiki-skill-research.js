// Generated Engineer PvE mechanics research from the Guild Wars 2 Wiki.
// Snapshot: 2026-07-28. Runtime tests never fetch the network.
// Categories: Engineer skills, Scrapper skills, Holosmith skills, Mechanist skills, Amalgam skills.

export const WIKI_DATA_SNAPSHOT = "2026-07-28";
export const WIKI_SKILL_RESEARCH = [
  {
    "page": "Med Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Med_Kit",
    "revisionId": 2649744,
    "revisionTimestamp": "2023-02-04T10:42:52Z",
    "ids": [
      5802
    ],
    "description": "Equip a kit that replaces your weapon with healing skills.",
    "specialization": "",
    "slot": "healing",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Grenade Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grenade_Kit",
    "revisionId": 3094793,
    "revisionTimestamp": "2026-01-17T09:20:39Z",
    "ids": [
      5805,
      6020
    ],
    "description": "Equip a kit that replaces your weapon with grenade skills.",
    "specialization": "",
    "slot": "utility",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Poison Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Poison_Grenade",
    "revisionId": 2969635,
    "revisionTimestamp": "2025-05-23T12:41:52Z",
    "ids": [
      5806
    ],
    "description": "Throw several grenades that explode in poisonous blasts.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "Poison Grenade (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "poisoned",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Shrapnel Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Shrapnel_Grenade",
    "revisionId": 3128690,
    "revisionTimestamp": "2026-04-15T17:55:11Z",
    "ids": [
      5807
    ],
    "description": "Throw grenades that explode in a hail of shrapnel, causing bleeding.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "5",
    "ammo": "",
    "underwaterReplacement": "Shrapnel Grenade (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.63,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "7"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Grenade",
    "revisionId": 2777029,
    "revisionTimestamp": "2023-12-09T15:37:58Z",
    "ids": [
      5808
    ],
    "description": "Throw grenades that explode in blinding flashes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "Flash Grenade (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "blinded",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Freeze Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Freeze_Grenade",
    "revisionId": 2840067,
    "revisionTimestamp": "2024-06-29T08:54:49Z",
    "ids": [
      5809
    ],
    "description": "Throw grenades that chill foes with frigid blasts.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "Freeze Grenade (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "chilled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Grenade Barrage",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grenade_Barrage",
    "revisionId": 3031564,
    "revisionTimestamp": "2025-09-20T18:17:11Z",
    "ids": [
      5810
    ],
    "description": "Throw several grenades at once.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Grenade Kit",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "Grenade Barrage (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Grenades",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Personal Battering Ram",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Personal_Battering_Ram",
    "revisionId": 2840074,
    "revisionTimestamp": "2024-06-29T09:00:35Z",
    "ids": [
      5811,
      29991
    ],
    "description": "Launch a target foe with a concealed ram head.",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "5",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "launch",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "maximum count",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "count recharge",
        "values": [
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bomb Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bomb_Kit",
    "revisionId": 2991548,
    "revisionTimestamp": "2025-06-28T08:19:25Z",
    "ids": [
      5812
    ],
    "description": "Equip a kit that replaces your weapon with bomb skills.",
    "specialization": "",
    "slot": "utility",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Big Ol' Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Big_Ol'_Bomb",
    "revisionId": 3154425,
    "revisionTimestamp": "2026-06-02T17:06:45Z",
    "ids": [
      5813
    ],
    "description": "Set a timed charge with a big blast that knocks down nearby foes. This skill blast finishes twice.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Bomb Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "knockdown",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rifle Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rifle_Turret",
    "revisionId": 3172739,
    "revisionTimestamp": "2026-07-23T07:30:07Z",
    "ids": [
      5818
    ],
    "description": "Build a rifle turret that shoots at foes. Turrets automatically overcharge when they are first placed, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "Harpoon Turret",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "10 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Junk",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Junk",
    "revisionId": 2362832,
    "revisionTimestamp": "2021-10-31T12:22:21Z",
    "ids": [
      5820
    ],
    "description": "Throw a bit of junk and inflict a random condition on your foe.",
    "specialization": "",
    "slot": "downed",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "0.25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "chilled",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "weakness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir B",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_B",
    "revisionId": 2990854,
    "revisionTimestamp": "2025-06-27T04:12:36Z",
    "ids": [
      5821
    ],
    "description": "Drink Elixir B to gain fury, might, resolution, and swiftness, then extend the duration of boons on yourself.",
    "specialization": "",
    "slot": "utility",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "fury",
        "values": [
          "10",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "resolution",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "swiftness",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "duration increase",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Galvanic Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Galvanic_Bomb",
    "revisionId": 2991161,
    "revisionTimestamp": "2025-06-27T19:55:58Z",
    "ids": [
      5822
    ],
    "description": "Set an explosive that electrocutes nearby foes, dazing them.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Bomb Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "16",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "daze",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "1"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Fire Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Fire_Bomb",
    "revisionId": 2990790,
    "revisionTimestamp": "2025-06-27T02:14:03Z",
    "ids": [
      5823
    ],
    "description": "Set an explosive that burns nearby foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Bomb Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "Initial Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "2"
        ],
        "label": "Pulse Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "1"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "fire"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Smoke Bomb (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Smoke_Bomb_(engineer_skill)",
    "revisionId": 2990788,
    "revisionTimestamp": "2025-06-27T02:09:22Z",
    "ids": [
      5824
    ],
    "description": "Set a timed charge that creates a cloud of smoke, blinding nearby foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Bomb Kit",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "blinded",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "1"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "smoke"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Slick Shoes",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Slick_Shoes",
    "revisionId": 3170241,
    "revisionTimestamp": "2026-07-17T23:53:57Z",
    "ids": [
      5825,
      30828
    ],
    "description": "Spray oil behind you, knocking down foes. If underwater, foes entering the field are blinded and slowed.",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "Slick Shoes (underwater)",
    "facts": [
      {
        "kind": "Number of Hits per Target",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "knockdown",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Oil Slick Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Fragmentation Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Fragmentation_Shot",
    "revisionId": 2842793,
    "revisionTimestamp": "2024-07-08T05:00:15Z",
    "ids": [
      5827
    ],
    "description": "Fire a shot that bleeds the impacted target and then shatters, dealing damage to nearby enemies.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "pistol",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Poison Dart Volley",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Poison_Dart_Volley",
    "revisionId": 2794142,
    "revisionTimestamp": "2024-02-08T22:07:06Z",
    "ids": [
      5828
    ],
    "description": "Fire a volley of darts that poison foes.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "pistol",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "poisoned",
        "values": [
          "7"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Static Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Static_Shot",
    "revisionId": 2776280,
    "revisionTimestamp": "2023-12-05T01:12:17Z",
    "ids": [
      5829
    ],
    "description": "Discharge a lightning shot that bounces between multiple foes, blinding and confusing them.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "pistol",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "blinded",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bounces",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Glue Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Glue_Shot",
    "revisionId": 2810145,
    "revisionTimestamp": "2024-03-20T01:03:32Z",
    "ids": [
      5830
    ],
    "description": "Coat the target area with a glue puddle that immobilizes foes on impact, then cripples foes that remain within.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "pistol",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "immobile",
        "values": [
          "1.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "Glue Puddle Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blowtorch",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blowtorch",
    "revisionId": 3128686,
    "revisionTimestamp": "2026-04-15T17:53:07Z",
    "ids": [
      5831
    ],
    "description": "Unleash flames from your pistol to burn foes. Deals more damage the closer you are.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "pistol",
    "weapon": "",
    "activation": "0.5",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Maximum Damage",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Minimum Damage",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pistol",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "4.5"
        ],
        "label": "Maximum Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "Minimum Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir X",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_X",
    "revisionId": 2882042,
    "revisionTimestamp": "2024-10-08T17:57:46Z",
    "ids": [
      5832
    ],
    "description": "Drink Elixir X to become a rampaging brute, whirling tornado, or powerful lich. Underwater, become either a withering plague or a whirlpool.",
    "specialization": "",
    "slot": "elite",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "75",
    "ammo": "",
    "underwaterReplacement": "Elixir X (underwater)",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Tornado (effect)",
          "15"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Rampage (effect)",
          "15"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Lich Form (effect)",
          "15"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Elixir H",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_H",
    "revisionId": 2689978,
    "revisionTimestamp": "2023-06-28T18:19:25Z",
    "ids": [
      5834
    ],
    "description": "Drink Elixir H to heal yourself and gain protection, regeneration, and swiftness.",
    "specialization": "",
    "slot": "healing",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "5560"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "protection",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "swiftness",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flame Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flame_Turret",
    "revisionId": 3172734,
    "revisionTimestamp": "2026-07-23T07:26:45Z",
    "ids": [
      5836
    ],
    "description": "Deploy a turret that burns foes. Turrets automatically overcharge when they are first placed, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "10 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "500"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Net Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Net_Turret",
    "revisionId": 3172725,
    "revisionTimestamp": "2026-07-23T07:15:10Z",
    "ids": [
      5837
    ],
    "description": "Build a net turret that immobilizes nearby foes. This turret overcharges when it is first placed.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "immobile",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "20 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Thumper Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Thumper_Turret",
    "revisionId": 3172742,
    "revisionTimestamp": "2026-07-23T07:35:01Z",
    "ids": [
      5838
    ],
    "description": "Build a high-health thumper turret that damages nearby foes. Turrets automatically overcharge when they are first placed, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "20 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bomb",
    "revisionId": 2990793,
    "revisionTimestamp": "2025-06-27T02:17:01Z",
    "ids": [
      5842
    ],
    "description": "Set an explosive that damages nearby foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Bomb Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "1"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Healing Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Healing_Turret",
    "revisionId": 3172740,
    "revisionTimestamp": "2026-07-23T07:31:59Z",
    "ids": [
      5857
    ],
    "description": "Deploy a turret that heals you briefly, then regenerates you and your allies. Turrets automatically overcharge when they are first dropped, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "healing",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "2520"
        ],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "10 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "480"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir C",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_C",
    "revisionId": 3154834,
    "revisionTimestamp": "2026-06-03T10:24:37Z",
    "ids": [
      5860
    ],
    "description": "Drink Elixir C, converting all conditions into boons, then heal yourself per boon on you.",
    "specialization": "",
    "slot": "utility",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": 0.05,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Conditions Converted to Boons",
        "values": [
          "13"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir S",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_S",
    "revisionId": 2840048,
    "revisionTimestamp": "2024-06-29T08:34:14Z",
    "ids": [
      5861
    ],
    "description": "Drink Elixir S to shrink yourself, recover from stun, and evade attacks.",
    "specialization": "",
    "slot": "utility",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "capture",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir U",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_U",
    "revisionId": 3021732,
    "revisionTimestamp": "2025-08-27T01:05:43Z",
    "ids": [
      5862
    ],
    "description": "Drink Elixir U, gaining quickness, stability, and vigor.",
    "specialization": "",
    "slot": "utility",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "quickness",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vigor",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Utility Goggles",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Utility_Goggles",
    "revisionId": 2990913,
    "revisionTimestamp": "2025-06-27T06:32:57Z",
    "ids": [
      5865,
      29591
    ],
    "description": "Break out of stun, gaining resistance, clearing blindness, and removing damaging conditions.",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "resistance",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "protection",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "blinded"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir R",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_R",
    "revisionId": 2633464,
    "revisionTimestamp": "2023-01-10T22:07:14Z",
    "ids": [
      5867,
      6091
    ],
    "description": "Toss Elixir R to revive allies at a location.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir R",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "90",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "revive",
        "values": [
          "17"
        ],
        "label": "Revive Percent per Pulse",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Supply Crate",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Supply_Crate",
    "revisionId": 3172741,
    "revisionTimestamp": "2026-07-23T07:32:56Z",
    "ids": [
      5868
    ],
    "description": "Request a supply drop of turrets. Turrets automatically overcharge when they are first dropped, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "elite",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "75",
    "ammo": "",
    "underwaterReplacement": "Supply Crate (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "25 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Automatic Fire",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Automatic_Fire",
    "revisionId": 3172730,
    "revisionTimestamp": "2026-07-23T07:21:23Z",
    "ids": [
      5874
    ],
    "description": "Overcharge your rifle turret to fire piercing shots that inflict vulnerability.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Rifle Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "Automatic Fire (Harpoon Turret)",
    "facts": [
      {
        "kind": "Rate of Fire Increase",
        "values": [
          "50%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grenade",
    "revisionId": 3123237,
    "revisionTimestamp": "2026-04-05T10:17:36Z",
    "ids": [
      5882
    ],
    "description": "Throw several grenades that explode.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "Grenade (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Thump",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Thump",
    "revisionId": 3172743,
    "revisionTimestamp": "2026-07-23T07:36:01Z",
    "ids": [
      5889
    ],
    "description": "Overcharge your thumper turret to launch nearby foes.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Thumper Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "launch",
        "values": [
          "0"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Electrified Net",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Electrified_Net",
    "revisionId": 3172726,
    "revisionTimestamp": "2026-07-23T07:16:34Z",
    "ids": [
      5893
    ],
    "description": "Overcharge your turret to fire an electrified net that immobilizes and stuns.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Net Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "immobile",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Smoke Screen (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Smoke_Screen_(engineer_skill)",
    "revisionId": 3172737,
    "revisionTimestamp": "2026-07-23T07:28:19Z",
    "ids": [
      5900
    ],
    "description": "Overcharge your flame turret, releasing a smoke screen that blinds nearby foes.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Flame Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "blinded",
        "values": [
          "2"
        ],
        "label": "Blind per Pulse",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "smoke"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Tool Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Tool_Kit",
    "revisionId": 3121021,
    "revisionTimestamp": "2026-03-29T15:03:39Z",
    "ids": [
      5904
    ],
    "description": "Equip a kit that gives you a variety of tools.",
    "specialization": "",
    "slot": "utility",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Pry Bar",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Pry_Bar",
    "revisionId": 3171241,
    "revisionTimestamp": "2026-07-19T16:34:53Z",
    "ids": [
      5905
    ],
    "description": "Confuse your foe by smacking them with a pry bar.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Boots",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Boots",
    "revisionId": 2689952,
    "revisionTimestamp": "2023-06-28T17:48:58Z",
    "ids": [
      5910,
      29522
    ],
    "description": "Fly forward, removing movement-impairing conditions and damaging foes with your rocket exhaust.<br>{{gray|Movement-impairing conditions include cripple, chill, and immobilize.}}",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "2",
    "ammo": "",
    "underwaterReplacement": "Rocket Boots (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "condition",
        "values": [
          "Crippled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Chilled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Immobile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "maximum count",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "count recharge",
        "values": [
          "16"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Rocket Distance",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Turret",
    "revisionId": 3172758,
    "revisionTimestamp": "2026-07-23T07:46:20Z",
    "ids": [
      5912
    ],
    "description": "Build a turret that fires rockets. Turrets automatically overcharge when they are first placed, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "20 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Explosive Rockets",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Explosive_Rockets",
    "revisionId": 3172754,
    "revisionTimestamp": "2026-07-23T07:43:27Z",
    "ids": [
      5913
    ],
    "description": "Overcharge your turret to fire explosive rockets.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Rocket Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "knockdown",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Floating Mine",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Floating_Mine",
    "revisionId": 2395077,
    "revisionTimestamp": "2022-02-25T03:34:52Z",
    "ids": [
      5916
    ],
    "description": "Throw out a mine that explodes on contact.",
    "specialization": "",
    "slot": "drowning",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "0",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Anchor",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Anchor",
    "revisionId": 2742967,
    "revisionTimestamp": "2023-09-23T03:52:50Z",
    "ids": [
      5917
    ],
    "description": "Sink your foe.",
    "specialization": "",
    "slot": "drowning",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "sink",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Buoy",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Buoy",
    "revisionId": 2413922,
    "revisionTimestamp": "2022-03-03T21:42:17Z",
    "ids": [
      5918
    ],
    "description": "Inflate a buoy, floating more quickly to the surface.",
    "specialization": "",
    "slot": "drowning",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "3",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Flamethrower",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flamethrower",
    "revisionId": 2994806,
    "revisionTimestamp": "2025-07-03T01:18:32Z",
    "ids": [
      5927
    ],
    "description": "Arm yourself with a flamethrower that replaces your weapon skills.",
    "specialization": "",
    "slot": "utility",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": []
  },
  {
    "page": "Flame Jet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flame_Jet",
    "revisionId": 3087889,
    "revisionTimestamp": "2026-01-02T02:44:22Z",
    "ids": [
      5928
    ],
    "description": "Spray fire in a cone pattern while moving, burning foes on the final attack. Deals 10% bonus damage to burning targets.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Flamethrower",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "2.25",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": 10,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Attacks per Second",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "425"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Napalm",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Napalm",
    "revisionId": 3154839,
    "revisionTimestamp": "2026-06-03T10:25:47Z",
    "ids": [
      5929
    ],
    "description": "Immolate enemies in front of you with a cone of intense fire.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Flamethrower",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "2.25",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 5,
        "strikes": 10,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "3.25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 10,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Air Blast",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Air_Blast",
    "revisionId": 3035573,
    "revisionTimestamp": "2025-10-01T12:53:53Z",
    "ids": [
      5930
    ],
    "description": "Push back foes and projectiles with a hot-air blast, burning foes that are already on fire.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Flamethrower",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "knockback",
        "values": [
          "400"
        ],
        "label": "Knockback Distance",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flame Blast",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flame_Blast",
    "revisionId": 3163855,
    "revisionTimestamp": "2026-06-27T01:59:21Z",
    "ids": [
      5931
    ],
    "description": "Fire a napalm ball that explodes on impact.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Flamethrower",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "6"
        ],
        "label": "Explosion Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "Blast Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir Gun",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_Gun",
    "revisionId": 2649918,
    "revisionTimestamp": "2023-02-04T10:46:43Z",
    "ids": [
      5933
    ],
    "description": "Arm yourself with an elixir gun that replaces your weapon skills.",
    "specialization": "",
    "slot": "utility",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Tranquilizer Dart",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Tranquilizer_Dart",
    "revisionId": 2363068,
    "revisionTimestamp": "2021-10-31T12:48:39Z",
    "ids": [
      5934
    ],
    "description": "Fire a dart that bleeds and weakens foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "weakness",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Glob Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Glob_Shot",
    "revisionId": 2932034,
    "revisionTimestamp": "2025-02-13T14:20:05Z",
    "ids": [
      5935
    ],
    "description": "Fire a bouncing glob that cripples foes and grants swiftness to you and your allies. The first enemy struck is immobilized.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "swiftness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "immobilize",
        "values": [
          "2"
        ],
        "label": "First-Hit Immobilize",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bounces",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Acid Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Acid_Bomb",
    "revisionId": 3110849,
    "revisionTimestamp": "2026-02-24T19:22:36Z",
    "ids": [
      5936
    ],
    "description": "Leap backward, spraying an acidic elixir on the ground that damages nearby foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "Elixir",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.85,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Initial Damage",
        "coefficient": 1.35,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Distance",
        "values": [
          "550"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Super Elixir",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Super_Elixir",
    "revisionId": 2956317,
    "revisionTimestamp": "2025-04-15T17:40:32Z",
    "ids": [
      5937
    ],
    "description": "Shoot an elixir orb, healing allies when it bursts and creating an area of continual healing.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "Elixir",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "16",
    "ammo": "",
    "underwaterReplacement": "Super Elixir (underwater)",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "900"
        ],
        "label": "Impact Heal",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "260"
        ],
        "label": "Pulse Heal",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Rifle Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Rifle_Turret",
    "revisionId": 3172731,
    "revisionTimestamp": "2026-07-23T07:22:01Z",
    "ids": [
      5957
    ],
    "description": "Detonate your rifle turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Rifle Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "Detonate Harpoon Turret",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Thumper Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Thumper_Turret",
    "revisionId": 3172744,
    "revisionTimestamp": "2026-07-23T07:36:53Z",
    "ids": [
      5960
    ],
    "description": "Detonate your thumper turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Thumper Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Healing Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Healing_Turret",
    "revisionId": 3172716,
    "revisionTimestamp": "2026-07-23T07:06:15Z",
    "ids": [
      5961
    ],
    "description": "Detonate your healing turret.",
    "specialization": "",
    "slot": "healing",
    "type": "",
    "kit": "",
    "parent": "Healing Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Grappling Line",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grappling_Line",
    "revisionId": 2742966,
    "revisionTimestamp": "2023-09-23T03:52:18Z",
    "ids": [
      5962
    ],
    "description": "Throw out a grappling line to pull your foe to you.",
    "specialization": "",
    "slot": "downed",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.531,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Booby Trap",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Booby_Trap",
    "revisionId": 2413057,
    "revisionTimestamp": "2022-03-03T16:01:48Z",
    "ids": [
      5963
    ],
    "description": "Set off an explosive booby trap, launching nearby foes with a powerful blast.",
    "specialization": "",
    "slot": "downed",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "launch",
        "values": [
          "480"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Fumigate",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Fumigate",
    "revisionId": 3010991,
    "revisionTimestamp": "2025-08-11T19:46:09Z",
    "ids": [
      5965
    ],
    "description": "Spray a cone of elixir fumes, inflicting poison and vulnerability to foes and curing conditions on allies with every strike.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "2.25",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "poisoned",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "2"
        ],
        "label": "Initial Self Conditions Removed",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Healing Mist",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Healing_Mist",
    "revisionId": 3171236,
    "revisionTimestamp": "2026-07-19T16:25:14Z",
    "ids": [
      5966
    ],
    "description": "Vent a healing mist, granting regeneration to yourself and allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Elixir, Tool belt",
    "kit": "",
    "parent": "Elixir Gun",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "regeneration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir B",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_B",
    "revisionId": 2767658,
    "revisionTimestamp": "2023-11-28T19:43:42Z",
    "ids": [
      5967,
      6092
    ],
    "description": "Toss Elixir B at a location, granting stability and one of the following boons to allies: fury, might, or resolution.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir B",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Stability",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "fury",
        "values": [
          "10",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "resolution",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir R",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_R",
    "revisionId": 2991321,
    "revisionTimestamp": "2025-06-27T23:15:10Z",
    "ids": [
      5968
    ],
    "description": "Drink Elixir R to refill your endurance and remove immobilizing effects.",
    "specialization": "",
    "slot": "utility",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "condition",
        "values": [
          "Immobile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Endurance Gained",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir C",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_C",
    "revisionId": 2690120,
    "revisionTimestamp": "2023-06-28T22:57:02Z",
    "ids": [
      5969,
      6077
    ],
    "description": "Toss Elixir C, converting conditions into boons for allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir C",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "16",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Conditions Converted to Boons",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir U",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_U",
    "revisionId": 2774084,
    "revisionTimestamp": "2023-12-03T13:29:19Z",
    "ids": [
      5970,
      6089
    ],
    "description": "Toss Elixir U, breaking stuns on allies and granting them superspeed.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir U",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir S",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_S",
    "revisionId": 2689987,
    "revisionTimestamp": "2023-06-28T18:25:52Z",
    "ids": [
      5972,
      6090
    ],
    "description": "Toss Elixir S, granting stealth to allies in the target area.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir S",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "stealth",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Superspeed (skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Superspeed_(skill)",
    "revisionId": 2840079,
    "revisionTimestamp": "2024-06-29T09:04:39Z",
    "ids": [
      5973
    ],
    "description": "Activate your slick shoes, enabling you to move at superior speeds.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Slick Shoes",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir H",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_H",
    "revisionId": 2690121,
    "revisionTimestamp": "2023-06-28T22:57:41Z",
    "ids": [
      5978
    ],
    "description": "Toss Elixir H to grant protection, regeneration, and vigor to allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt, Elixir",
    "kit": "",
    "parent": "Elixir H",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "protection",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vigor",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Cleansing Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Cleansing_Burst",
    "revisionId": 3172714,
    "revisionTimestamp": "2026-07-23T07:04:19Z",
    "ids": [
      5980
    ],
    "description": "Overcharge your healing turret to cure conditions and grant a burst of healing.",
    "specialization": "",
    "slot": "healing",
    "type": "",
    "kit": "",
    "parent": "Healing Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "2520"
        ],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Conditions Removed",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "480"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Launch Personal Battering Ram",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Launch_Personal_Battering_Ram",
    "revisionId": 2742959,
    "revisionTimestamp": "2023-09-23T03:38:57Z",
    "ids": [
      5982
    ],
    "description": "Shoot a ram's head in front of you, impairing any struck foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Personal Battering Ram",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "crippled",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "daze alt",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Kick",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Kick",
    "revisionId": 2372281,
    "revisionTimestamp": "2021-12-01T21:04:30Z",
    "ids": [
      5983
    ],
    "description": "Use your rocket boots to do an explosive kick that burns foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Rocket Boots",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Net Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Net_Turret",
    "revisionId": 3172728,
    "revisionTimestamp": "2026-07-23T07:17:30Z",
    "ids": [
      5984
    ],
    "description": "Detonate your net turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Net Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Flame Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Flame_Turret",
    "revisionId": 3172738,
    "revisionTimestamp": "2026-07-23T07:29:04Z",
    "ids": [
      5985
    ],
    "description": "Detonate your flame turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Flame Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Smack",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Smack",
    "revisionId": 2475057,
    "revisionTimestamp": "2022-03-23T21:32:18Z",
    "ids": [
      5992
    ],
    "description": "Smack your foe. Repair turrets.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "5%"
        ],
        "label": "Heal Percent",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Whack",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Whack",
    "revisionId": 2475058,
    "revisionTimestamp": "2022-03-23T21:33:03Z",
    "ids": [
      5993
    ],
    "description": "Whack your foe. Repairs turrets.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "5%"
        ],
        "label": "Turret Heal Percent",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Thwack",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Thwack",
    "revisionId": 2475059,
    "revisionTimestamp": "2022-03-23T21:33:53Z",
    "ids": [
      5994
    ],
    "description": "Thwack your foe. Repairs turrets.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "5%"
        ],
        "label": "Turret Heal Percent",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Box of Nails",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Box_of_Nails",
    "revisionId": 3094905,
    "revisionTimestamp": "2026-01-17T14:14:07Z",
    "ids": [
      5995
    ],
    "description": "Scatter nails that bleed and cripple foes. The first pulse of this skill will immobilize foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "Box of Piranhas",
    "facts": [
      {
        "kind": "bleeding",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "immobile",
        "values": [
          "1.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Box of Nails Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Magnet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnet",
    "revisionId": 2956313,
    "revisionTimestamp": "2025-04-15T17:38:28Z",
    "ids": [
      5996
    ],
    "description": "Pull your target to you.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "defiance break",
        "values": [
          "350"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Gear Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Gear_Shield",
    "revisionId": 2710433,
    "revisionTimestamp": "2023-07-29T12:49:38Z",
    "ids": [
      5998
    ],
    "description": "Block attacks.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "2",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Wrench",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Wrench",
    "revisionId": 3171242,
    "revisionTimestamp": "2026-07-19T16:36:44Z",
    "ids": [
      5999
    ],
    "description": "Throw a wrench that returns to you, striking foes each way.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Tool Kit",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rifle Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rifle_Burst",
    "revisionId": 2956314,
    "revisionTimestamp": "2025-04-15T17:38:57Z",
    "ids": [
      6003
    ],
    "description": "Deliver a quick burst of fire that pierces targets, followed by an explosive grenade.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Net Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Net_Shot",
    "revisionId": 3094907,
    "revisionTimestamp": "2026-01-17T14:21:48Z",
    "ids": [
      6004
    ],
    "description": "Immobilize foes with a net shot.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "9",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "immobile",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Jump Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Jump_Shot",
    "revisionId": 2956311,
    "revisionTimestamp": "2025-04-15T17:38:14Z",
    "ids": [
      6005,
      5817
    ],
    "description": "Blast the ground, damaging nearby foes and leaping to your target.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "18",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Leap Damage",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Landing Damage",
        "coefficient": 2.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "7"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "0.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "800"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Lesser Grenade Barrage",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Lesser_Grenade_Barrage",
    "revisionId": 2342663,
    "revisionTimestamp": "2021-10-05T15:29:42Z",
    "ids": [
      6050
    ],
    "description": "Throw several grenades at once.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "6"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blast Radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Magnetic Shield (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnetic_Shield_(engineer_skill)",
    "revisionId": 2621669,
    "revisionTimestamp": "2022-12-07T01:57:37Z",
    "ids": [
      6053
    ],
    "description": "Create a magnetic field that reflects projectiles and can be released to knock back foes.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "shield",
    "weapon": "",
    "activation": "3",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Static Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Static_Shield",
    "revisionId": 2628459,
    "revisionTimestamp": "2022-12-29T00:48:40Z",
    "ids": [
      6054
    ],
    "description": "Electrify your shield, preparing to throw it at foes. Stun nearby enemies that attack you while blocking.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "shield",
    "weapon": "",
    "activation": "2.5",
    "recharge": "24",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "stun",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2.5"
        ],
        "label": "Block Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Shield",
    "revisionId": 2413005,
    "revisionTimestamp": "2022-03-03T15:53:48Z",
    "ids": [
      6057
    ],
    "description": "Throw your charged shield. Dazes foes it hits on the way out and back.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "shield",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shield",
        "gameModes": []
      },
      {
        "kind": "daze",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Elixir C",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_C",
    "revisionId": 2358773,
    "revisionTimestamp": "2021-10-30T17:55:25Z",
    "ids": [
      6078
    ],
    "description": "Burst the bottle, converting conditions into boons for allies in your area.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir C",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Detonate Elixir B",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_B",
    "revisionId": 3154948,
    "revisionTimestamp": "2026-06-03T10:55:35Z",
    "ids": [
      6082
    ],
    "description": "Burst the bottle to grant stability and one of the following boons to allies: fury, might, resolution, or swiftness.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir B",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Detonate Elixir S",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_S",
    "revisionId": 3154951,
    "revisionTimestamp": "2026-06-03T10:58:22Z",
    "ids": [
      6084
    ],
    "description": "Burst the bottle, granting allies stealth.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir S",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Detonate Elixir R",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_R",
    "revisionId": 2358775,
    "revisionTimestamp": "2021-10-30T17:55:50Z",
    "ids": [
      6086
    ],
    "description": "Burst the bottle, reviving allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir R",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Detonate Elixir U",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_U",
    "revisionId": 2358777,
    "revisionTimestamp": "2021-10-30T17:56:03Z",
    "ids": [
      6088
    ],
    "description": "Detonate Elixir U, causing it to grant allies superspeed and break them out of stun.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir U",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "quickness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Harpoon Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Harpoon_Turret",
    "revisionId": 3172759,
    "revisionTimestamp": "2026-07-23T07:47:21Z",
    "ids": [
      6093
    ],
    "description": "Build a harpoon turret that shoots at foes. Turrets automatically overcharge when they are first placed, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "utility",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.85,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "10 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "Rate of Fire",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Harpoon Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Harpoon_Turret",
    "revisionId": 3172762,
    "revisionTimestamp": "2026-07-23T07:49:37Z",
    "ids": [
      6097
    ],
    "description": "Detonate your harpoon turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Harpoon Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Automatic Fire (Harpoon Turret)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Automatic_Fire_(Harpoon_Turret)",
    "revisionId": 3172760,
    "revisionTimestamp": "2026-07-23T07:48:43Z",
    "ids": [
      6098
    ],
    "description": "Overcharge your harpoon turret to fire a burst of automated shots.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Harpoon Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Rate of Fire Increase",
        "values": [
          "50%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "Attack Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Super Elixir (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Super_Elixir_(underwater)",
    "revisionId": 2786664,
    "revisionTimestamp": "2024-01-03T17:58:24Z",
    "ids": [
      6102
    ],
    "description": "Shoot an elixir orb, healing allies when it bursts and creating an area of continual healing.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "Elixir",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "16",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "700"
        ],
        "label": "Impact Heal",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "204"
        ],
        "label": "Pulse Heal",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Super Elixir (chain skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Super_Elixir_(chain_skill)",
    "revisionId": 2777033,
    "revisionTimestamp": "2023-12-09T15:44:22Z",
    "ids": [
      6104
    ],
    "description": "Burst the orb, instantly healing your allies and creating an area of continual healing.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "Elixir",
    "kit": "Elixir Gun",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "700"
        ],
        "label": "Impact Heal",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "2040"
        ],
        "label": "Pulse Heal",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Stow Med Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Stow_Med_Kit",
    "revisionId": 3025172,
    "revisionTimestamp": "2025-09-05T16:11:02Z",
    "ids": [
      6109
    ],
    "description": "Stow your med kit.",
    "specialization": "",
    "slot": "healing",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Stow Flamethrower",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Stow_Flamethrower",
    "revisionId": 2992528,
    "revisionTimestamp": "2025-06-29T18:35:33Z",
    "ids": [
      6114
    ],
    "description": "Stow your flamethrower.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Stow Elixir Gun",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Stow_Elixir_Gun",
    "revisionId": 3025176,
    "revisionTimestamp": "2025-09-05T16:24:02Z",
    "ids": [
      6115
    ],
    "description": "Stow your elixir gun.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Detonate Elixir H",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_H",
    "revisionId": 3154960,
    "revisionTimestamp": "2026-06-03T11:05:14Z",
    "ids": [
      6119
    ],
    "description": "Burst a bottle of Elixir H, granting protection, regeneration, and swiftness to allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir H",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Magnetic Inversion",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnetic_Inversion",
    "revisionId": 2622046,
    "revisionTimestamp": "2022-12-08T10:12:16Z",
    "ids": [
      6126
    ],
    "description": "Release the magnetic field to knock back nearby foes.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "shield",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shield",
        "gameModes": []
      },
      {
        "kind": "push",
        "values": [
          "300"
        ],
        "label": "Knockback",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Rocket Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Rocket_Turret",
    "revisionId": 3172757,
    "revisionTimestamp": "2026-07-23T07:44:01Z",
    "ids": [
      6134
    ],
    "description": "Detonate your rocket turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "Detonate Rocket Turret (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Net Wall",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Net_Wall",
    "revisionId": 2837709,
    "revisionTimestamp": "2024-06-23T08:34:13Z",
    "ids": [
      6145
    ],
    "description": "Launch a deployable net wall to immobilize foes caught within.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "18",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "harpoon gun",
        "gameModes": []
      },
      {
        "kind": "immobile",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Scatter Mines",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Scatter_Mines",
    "revisionId": 3165801,
    "revisionTimestamp": "2026-07-04T11:17:50Z",
    "ids": [
      6147
    ],
    "description": "Fire out a spread of explosive mines at your enemy.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 4.2,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "harpoon gun",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Homing Torpedo",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Homing_Torpedo",
    "revisionId": 2837701,
    "revisionTimestamp": "2024-06-23T08:34:03Z",
    "ids": [
      6148
    ],
    "description": "Fire a shot that homes in on your foe and detonates an area around them.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "harpoon gun",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Timed Charge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Timed_Charge",
    "revisionId": 2837720,
    "revisionTimestamp": "2024-06-23T08:34:25Z",
    "ids": [
      6149
    ],
    "description": "Fire a timed charge at your target, damaging and burning nearby foes when it detonates.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Explosion Damage",
        "coefficient": 3.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "harpoon gun",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Timer",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blunderbuss",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blunderbuss",
    "revisionId": 2956306,
    "revisionTimestamp": "2025-04-15T17:34:57Z",
    "ids": [
      6153
    ],
    "description": "Fire several shards of shrapnel that inflict more damage the closer you are to foes. You and nearby allies gain might.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Maximum Damage",
        "coefficient": 2.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Minimum Damage",
        "coefficient": 1.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "9"
        ],
        "label": "Maximum Bleeding",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "3"
        ],
        "label": "Minimum Bleeding",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "Boon Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Overcharged Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overcharged_Shot",
    "revisionId": 3094909,
    "revisionTimestamp": "2026-01-17T14:23:35Z",
    "ids": [
      6154
    ],
    "description": "Fire a blast so strong that it launches your foe as the recoil frees you from any movement-impairing conditions.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "14",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "condition",
        "values": [
          "Crippled",
          "Condition Removed"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Immobile",
          "Condition Removed"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Chilled",
          "Condition Removed"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "launch",
        "values": [
          "450"
        ],
        "label": "Foe Launch Distance",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Smoke Vent",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Smoke_Vent",
    "revisionId": 3171398,
    "revisionTimestamp": "2026-07-19T20:57:03Z",
    "ids": [
      6159
    ],
    "description": "Vent smoke from your flamethrower, blinding nearby foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Flamethrower",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "blinded",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Breaks Stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Mine",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Mine",
    "revisionId": 2750035,
    "revisionTimestamp": "2023-10-10T07:29:17Z",
    "ids": [
      6161,
      30337
    ],
    "description": "Throw out a remote-controlled land mine that damages, knocks back {{sic|it doesn't knock back, it stuns}}, and removes a boon from nearby foes.",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "Deploy Mine",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Boons Removed",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Proximity Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_(engineer_skill)",
    "revisionId": 2673935,
    "revisionTimestamp": "2023-04-18T12:08:55Z",
    "ids": [
      6162
    ],
    "description": "Detonate your mine to damage foes and remove a boon from them.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "Throw Mine",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Boons Removed",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Deploy Mine",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Deploy_Mine",
    "revisionId": 2650236,
    "revisionTimestamp": "2023-02-04T21:40:22Z",
    "ids": [
      6163,
      30893
    ],
    "description": "Deploy a remote-controlled mine that damages nearby foes and removes a boon.",
    "specialization": "",
    "slot": "utility",
    "type": "Gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.65,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "Boons Removed",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "number of targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mine Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mine_Field",
    "revisionId": 2673937,
    "revisionTimestamp": "2023-04-18T12:26:47Z",
    "ids": [
      6164
    ],
    "description": "Plant five mines around yourself.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Throw Mine",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "17",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Damage per Mine",
        "coefficient": 0.77,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "cripple",
        "values": [
          "2.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Mine Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Mine_Field",
    "revisionId": 3035410,
    "revisionTimestamp": "2025-10-01T02:22:04Z",
    "ids": [
      6166
    ],
    "description": "Detonate your mine{{sic|mines}}, damaging nearby foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Throw Mine",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Damage per Mine",
        "coefficient": 0.77,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Poison Grenade (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Poison_Grenade_(underwater)",
    "revisionId": 2969956,
    "revisionTimestamp": "2025-05-24T02:22:27Z",
    "ids": [
      6167
    ],
    "description": "Throw several grenades that explode in poisonous blasts.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "poisoned",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Freeze Grenade (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Freeze_Grenade_(underwater)",
    "revisionId": 2813879,
    "revisionTimestamp": "2024-04-07T16:53:00Z",
    "ids": [
      6168
    ],
    "description": "Throw grenades that chill foes with frigid blasts.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "chilled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Grenade (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Grenade_(underwater)",
    "revisionId": 2813737,
    "revisionTimestamp": "2024-04-06T18:31:56Z",
    "ids": [
      6169
    ],
    "description": "Throw grenades that explode in blinding flashes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "blinded",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Shrapnel Grenade (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Shrapnel_Grenade_(underwater)",
    "revisionId": 2786665,
    "revisionTimestamp": "2024-01-03T17:58:40Z",
    "ids": [
      6170
    ],
    "description": "Throw grenades that explode in a hail of shrapnel, causing bleeding.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "5",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.63,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Grenade (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grenade_(underwater)",
    "revisionId": 2786667,
    "revisionTimestamp": "2024-01-03T17:59:09Z",
    "ids": [
      6171
    ],
    "description": "Throw several grenades that explode.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Grenade Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Number of Grenades",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Grenade Barrage (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Grenade_Barrage_(underwater)",
    "revisionId": 3031566,
    "revisionTimestamp": "2025-09-20T18:19:39Z",
    "ids": [
      6172
    ],
    "description": "Throw several grenades that explode.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Grenade Kit",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Grenades",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Box of Piranhas",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Box_of_Piranhas",
    "revisionId": 3094906,
    "revisionTimestamp": "2026-01-17T14:20:37Z",
    "ids": [
      6175
    ],
    "description": "Release piranhas that bleed and cripple foes. The first pulse of this skill will immobilize foes who are movement impaired or disabled. {{gray|Disables include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.}}",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Tool Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "0.25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "bleeding",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "immobile",
        "values": [
          "1.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "count recharge",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Regenerating Mist",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Regenerating_Mist",
    "revisionId": 3116309,
    "revisionTimestamp": "2026-03-13T02:40:16Z",
    "ids": [
      6176
    ],
    "description": "Release a mist of healing liquid to regenerate nearby allies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Healing Turret",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "18",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "480"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket",
    "revisionId": 3172772,
    "revisionTimestamp": "2026-07-23T08:06:26Z",
    "ids": [
      6177
    ],
    "description": "Fire a rocket out of your belt that explodes on impact.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Rocket Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Surprise Shot (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Surprise_Shot_(engineer_skill)",
    "revisionId": 2827714,
    "revisionTimestamp": "2024-05-23T13:22:29Z",
    "ids": [
      6178
    ],
    "description": "Fire a bullet out of your belt.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Rifle Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "Harpoon (engineer skill)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Net Attack",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Net_Attack",
    "revisionId": 2475067,
    "revisionTimestamp": "2022-03-23T21:38:59Z",
    "ids": [
      6179
    ],
    "description": "Fire a net from your belt to immobilize your foe.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Net Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "38",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "immobile",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rumble",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rumble",
    "revisionId": 2361721,
    "revisionTimestamp": "2021-10-31T10:15:28Z",
    "ids": [
      6180
    ],
    "description": "Release a shock wave of inertial force to damage nearby foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Thumper Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "38",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "stability",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Napalm",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Napalm",
    "revisionId": 2362863,
    "revisionTimestamp": "2021-10-31T12:25:45Z",
    "ids": [
      6181
    ],
    "description": "Throw a ball of napalm that explodes on impact, burning foes around target location.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Flame Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.7,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "fire"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Harpoon (engineer skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Harpoon_(engineer_skill)",
    "revisionId": 2369087,
    "revisionTimestamp": "2021-11-22T01:47:00Z",
    "ids": [
      6182
    ],
    "description": "Launch a harpoon from your belt.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Harpoon Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Supply Crate (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Supply_Crate_(underwater)",
    "revisionId": 3172763,
    "revisionTimestamp": "2026-07-23T07:54:00Z",
    "ids": [
      6183
    ],
    "description": "Request a supply drop of turrets. Turrets automatically overcharge when they are first dropped, and they can be overcharged manually as long as they stay active.",
    "specialization": "",
    "slot": "elite",
    "type": "turret",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "75",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Overcharge Cooldown",
        "values": [
          "25 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Withering Plague",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Withering_Plague",
    "revisionId": 2363484,
    "revisionTimestamp": "2021-10-31T13:34:58Z",
    "ids": [
      10661
    ],
    "description": "Add bleeding to your plague.",
    "specialization": "",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "bleeding",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Plague of Darkness",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Plague_of_Darkness",
    "revisionId": 2361088,
    "revisionTimestamp": "2021-10-31T09:01:52Z",
    "ids": [
      10662
    ],
    "description": "Add blindness to your plague.",
    "specialization": "",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "blinded",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "torment",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Plague of Pestilence",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Plague_of_Pestilence",
    "revisionId": 2361090,
    "revisionTimestamp": "2021-10-31T09:02:04Z",
    "ids": [
      10663
    ],
    "description": "Add cripple and weakness to your plague and increase its damage dealt.",
    "specialization": "",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage increase",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "2.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "weakness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Confusing Speech",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Confusing_Speech",
    "revisionId": 2124493,
    "revisionTimestamp": "2020-09-30T11:09:37Z",
    "ids": [
      12334
    ],
    "description": "Confuse nearby foes with complex calculations.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Technobabble",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Pain Transference",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Pain_Transference",
    "revisionId": 2126990,
    "revisionTimestamp": "2020-09-30T12:08:42Z",
    "ids": [
      12335
    ],
    "description": "Send out a bolt that steals a boon from your foe and gives them one condition from you.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Pain Inverter",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Vent Radiation",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Vent_Radiation",
    "revisionId": 2129267,
    "revisionTimestamp": "2020-09-30T13:16:46Z",
    "ids": [
      12336
    ],
    "description": "Vent radioactive gas to poison nearby foes.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Radiation Field",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "poisoned",
        "values": [
          "9"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Invigorating Roar",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Invigorating_Roar",
    "revisionId": 2126221,
    "revisionTimestamp": "2020-09-30T11:49:00Z",
    "ids": [
      12354
    ],
    "description": "Let out an inspiring roar, removing weakness and vulnerability from allies and granting vigor.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Battle Roar",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "50",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "vigor",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Booby Trap (charr skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Booby_Trap_(charr_skill)",
    "revisionId": 2341683,
    "revisionTimestamp": "2021-09-30T06:30:59Z",
    "ids": [
      12355
    ],
    "description": "Place an explosive charge on yourself that is triggered by a melee attack.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Shrapnel Mine",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Time to trigger",
        "values": [
          "20 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Hidden Pistols",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Hidden_Pistols",
    "revisionId": 2197685,
    "revisionTimestamp": "2020-12-07T13:03:30Z",
    "ids": [
      12357
    ],
    "description": "Draw both hidden pistols and unload a volley of bullets on your foe.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Hidden Pistol",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "Number of Shots",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blessing of Dwayna",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blessing_of_Dwayna",
    "revisionId": 2633229,
    "revisionTimestamp": "2023-01-10T12:47:15Z",
    "ids": [
      12377
    ],
    "description": "Beseech Dwayna to restore health and grant regeneration to allies at target location.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Prayer to Dwayna",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "995"
        ],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blessing of Kormir",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blessing_of_Kormir",
    "revisionId": 2124042,
    "revisionTimestamp": "2020-09-30T10:59:41Z",
    "ids": [
      12378
    ],
    "description": "Beseech Kormir to remove one condition from your allies at the target location.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Prayer to Kormir",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blessing of Lyssa",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blessing_of_Lyssa",
    "revisionId": 2124044,
    "revisionTimestamp": "2020-09-30T10:59:43Z",
    "ids": [
      12379
    ],
    "description": "Pray to Lyssa, granting a random boon to allies and a random condition to foes at target location.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Prayer to Lyssa",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "35",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Eat Wurm Egg",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Eat_Wurm_Egg",
    "revisionId": 2125068,
    "revisionTimestamp": "2020-09-30T11:22:02Z",
    "ids": [
      12438
    ],
    "description": "Eat a wurm's egg to gain vigor and regeneration.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Call Wurm",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "regeneration",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vigor",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Eat Owl Egg",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Eat_Owl_Egg",
    "revisionId": 2185771,
    "revisionTimestamp": "2020-11-12T20:28:05Z",
    "ids": [
      12439
    ],
    "description": "Eat an owl's egg to gain swiftnesss{{sic|swiftness}} and regeneration.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Call Owl",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "regeneration",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "swiftness",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Vine",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Vine",
    "revisionId": 2872224,
    "revisionTimestamp": "2024-09-14T16:00:39Z",
    "ids": [
      12462
    ],
    "description": "Throw a vine and trip your foe.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Seed Turret",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "knockdown",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Vine Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Vine_Shield",
    "revisionId": 2206924,
    "revisionTimestamp": "2020-12-22T13:15:30Z",
    "ids": [
      12463
    ],
    "description": "Block incoming attacks.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Grasping Vines",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Leafy Bandage",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Leafy_Bandage",
    "revisionId": 2633228,
    "revisionTimestamp": "2023-01-10T12:46:52Z",
    "ids": [
      12465
    ],
    "description": "Use natural bandages to heal yourself and remove bleeding, burning, and poison.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Healing Seed",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "1630"
        ],
        "label": "",
        "coefficient": 0.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Lesser Elixir B",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Lesser_Elixir_B",
    "revisionId": 2690112,
    "revisionTimestamp": "2023-06-28T22:47:03Z",
    "ids": [
      13465
    ],
    "description": "Quaff an elixir, gaining boons.",
    "specialization": "",
    "slot": "trait",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "24",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "fury",
        "values": [
          "8",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "resolution",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "swiftness",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Ally Ward",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Ally_Ward",
    "revisionId": 2366410,
    "revisionTimestamp": "2021-11-10T13:54:49Z",
    "ids": [
      13516
    ],
    "description": "Grant protection to nearby allies.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "protection",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Static Discharge (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Static_Discharge_(trait_skill)",
    "revisionId": 2747727,
    "revisionTimestamp": "2023-10-02T09:42:53Z",
    "ids": [
      13552
    ],
    "description": "Hit multiple foes with arcs of chain lightning. Critical hits with this ability deal increased damage.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "critical damage increase",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bounces",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Plague",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Plague",
    "revisionId": 2761988,
    "revisionTimestamp": "2023-11-15T00:15:38Z",
    "ids": [
      15796
    ],
    "description": "Become a virulent cloud and inflict multiple conditions on foes you touch. Entering this form destroys all minions and removes spectral effects.",
    "specialization": "",
    "slot": "elite",
    "type": "",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "105",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.39,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "poisoned",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stability",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Boon Gain Interval",
        "values": [
          "3 seconds"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "3"
        ],
        "label": "Boon Application Interval",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Damaging Pulse",
        "values": [
          "1 second"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Snowman Turret (skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Snowman_Turret_(skill)",
    "revisionId": 2389512,
    "revisionTimestamp": "2022-02-07T16:21:14Z",
    "ids": [
      16739
    ],
    "description": "Build a snowman turret that throws snowballs at foes.",
    "specialization": "",
    "slot": "",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Snowman Turret",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Snowman_Turret",
    "revisionId": 2389513,
    "revisionTimestamp": "2022-02-07T16:21:28Z",
    "ids": [
      16744
    ],
    "description": "Detonate your snowman turret.",
    "specialization": "",
    "slot": "",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Drop Mine",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Drop_Mine",
    "revisionId": 2300489,
    "revisionTimestamp": "2021-08-02T05:48:09Z",
    "ids": [
      17810
    ],
    "description": "Drop a mine that deals damage to enemies that trigger it.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blast Radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Magnetic Bomb (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnetic_Bomb_(trait_skill)",
    "revisionId": 2998184,
    "revisionTimestamp": "2025-07-10T09:54:02Z",
    "ids": [
      17811
    ],
    "description": "Set a timed charge that pulls nearby foes.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "pull",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Superspeed (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Superspeed_(trait_skill)",
    "revisionId": 2319574,
    "revisionTimestamp": "2021-08-29T18:51:07Z",
    "ids": [
      17812
    ],
    "description": "Run at double speed.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Fire Shield (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Fire_Shield_(trait_skill)",
    "revisionId": 2308895,
    "revisionTimestamp": "2021-08-19T11:43:13Z",
    "ids": [
      17813
    ],
    "description": "Activate a fire shield that burns enemies who strike you, granting might for each burn applied.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Fire Aura",
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "might",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Magnetic Aura (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnetic_Aura_(trait_skill)",
    "revisionId": 2350826,
    "revisionTimestamp": "2021-10-17T06:07:59Z",
    "ids": [
      17814
    ],
    "description": "Become surrounded in a magnetic shield that reflects projectiles.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Magnetic Aura (effect)",
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Glue Trail",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Glue_Trail",
    "revisionId": 2308886,
    "revisionTimestamp": "2021-08-19T11:39:14Z",
    "ids": [
      17815
    ],
    "description": "Leave a trail of glue behind you that hampers enemy movement.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "immobilized",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir X (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_X_(underwater)",
    "revisionId": 3081586,
    "revisionTimestamp": "2025-12-20T14:30:45Z",
    "ids": [
      20451
    ],
    "description": "Drink Elixir X to become a rampaging brute or whirling tornado. Underwater, become either a withering plague or a whirlpool.",
    "specialization": "",
    "slot": "elite",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "85",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Whirlpool (effect)",
          "15"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Plague (effect)",
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "A.E.D.",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/A.E.D.",
    "revisionId": 2689974,
    "revisionTimestamp": "2023-06-28T18:16:21Z",
    "ids": [
      21659,
      30881
    ],
    "description": "Activate your A.E.D., enabling the system to heal you after a brief period of time. If you take lethal damage while A.E.D. is active, it ends and heals you for a large amount and removes conditions.",
    "specialization": "",
    "slot": "healing",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "24",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "12280"
        ],
        "label": "Healing when lethal damage taken",
        "coefficient": 1.72,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "4344"
        ],
        "label": "",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "A.E.D. (effect)",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Condition",
        "values": [
          "Burning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Condition",
        "values": [
          "Bleeding"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Condition",
        "values": [
          "Confusion"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Condition",
        "values": [
          "Poisoned"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Condition",
        "values": [
          "Torment"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Static Shock",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Static_Shock",
    "revisionId": 2969633,
    "revisionTimestamp": "2025-05-23T12:39:42Z",
    "ids": [
      21661
    ],
    "description": "Use your A.E.D. to stun an enemy.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "A.E.D.",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "2",
          ""
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bunker Down (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bunker_Down_(trait_skill)",
    "revisionId": 3171302,
    "revisionTimestamp": "2026-07-19T19:02:51Z",
    "ids": [
      24329
    ],
    "description": "Detonates when enemies draw near.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.95,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "Vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "60"
        ],
        "label": "Proximity Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Overfueled Flame Jet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overfueled_Flame_Jet",
    "revisionId": 2360963,
    "revisionTimestamp": "2021-10-31T08:45:41Z",
    "ids": [
      26027
    ],
    "description": "Spray out a cone of fire with freedom to move.",
    "specialization": "",
    "slot": "bundle",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "2.25",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "range",
        "values": [
          "425"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Reconstruction Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Reconstruction_Field",
    "revisionId": 2665583,
    "revisionTimestamp": "2023-03-12T20:55:59Z",
    "ids": [
      29505
    ],
    "description": "Establish a defensive field, granting protection to allies in its area.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Medic Gyro",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "protection",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir X (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_X_(underwater)",
    "revisionId": 2742961,
    "revisionTimestamp": "2023-09-23T03:40:29Z",
    "ids": [
      29515
    ],
    "description": "Toss your Elixir X forward. When the bottle bursts, transform enemies in the area into tuna.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "120",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Morphed (Polymorph Tuna)",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Supply Crate Turrets",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Supply_Crate_Turrets",
    "revisionId": 3172723,
    "revisionTimestamp": "2026-07-23T07:12:59Z",
    "ids": [
      29518
    ],
    "description": "Detonate your supply crate turrets.",
    "specialization": "",
    "slot": "elite",
    "type": "",
    "kit": "",
    "parent": "Supply Crate",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "Detonate Supply Crate Turrets (underwater)",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bandage Blast",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bandage_Blast",
    "revisionId": 3116241,
    "revisionTimestamp": "2026-03-12T21:18:52Z",
    "ids": [
      29547
    ],
    "description": "Fire several bandages ahead of you to heal allies.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Med Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Healing",
        "values": [
          "169"
        ],
        "label": "",
        "coefficient": 0.83,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "maximum count",
        "values": [
          "5"
        ],
        "label": "Bandages",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Invisible Analysis",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Invisible_Analysis",
    "revisionId": 2827737,
    "revisionTimestamp": "2024-05-23T14:12:57Z",
    "ids": [
      29606
    ],
    "description": "Analyze a stealthed foe, applying vulnerability.",
    "specialization": "",
    "slot": "trait",
    "type": "Tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "fury",
        "values": [
          "5",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 10,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Revealed",
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bypass Coating",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bypass_Coating",
    "revisionId": 2767683,
    "revisionTimestamp": "2023-11-28T20:04:35Z",
    "ids": [
      29665
    ],
    "description": "Splash a hypercoating on nearby allies, granting superspeed.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Blast Gyro Tag",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Cleansing Pulse",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Cleansing_Pulse",
    "revisionId": 3171304,
    "revisionTimestamp": "2026-07-19T19:04:19Z",
    "ids": [
      29712
    ],
    "description": "Cleanse a condition from nearby allies.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Regeneration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Conditions Removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Med Pack Drop",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Med_Pack_Drop",
    "revisionId": 2843582,
    "revisionTimestamp": "2024-07-13T13:58:48Z",
    "ids": [
      29716
    ],
    "description": "Call down a supply drop of med packs into a target area.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Supply Crate",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "50",
    "ammo": "",
    "underwaterReplacement": "Med Pack Drop (underwater)",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "1302"
        ],
        "label": "",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "14"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Elixir X",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Elixir_X",
    "revisionId": 2358778,
    "revisionTimestamp": "2021-10-30T17:56:25Z",
    "ids": [
      29722
    ],
    "description": "Burst the bottle, transforming enemies.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, elixir,transform",
    "kit": "",
    "parent": "Elixir X (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Purge Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Purge_Gyro",
    "revisionId": 2650010,
    "revisionTimestamp": "2023-02-04T10:48:59Z",
    "ids": [
      29739
    ],
    "description": "Deploy a purge gyro to remove conditions from you and your nearby allies.",
    "specialization": "Scrapper",
    "slot": "utility",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bandage Self",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bandage_Self",
    "revisionId": 2633219,
    "revisionTimestamp": "2023-01-10T12:38:23Z",
    "ids": [
      29772
    ],
    "description": "Bandage your wounds and heal yourself.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Med Kit",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "17",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "4920"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Negative Bash",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Negative_Bash",
    "revisionId": 2620113,
    "revisionTimestamp": "2022-12-02T19:49:00Z",
    "ids": [
      29785
    ],
    "description": "Slam your hammer into your foe to leave them vulnerable.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Lesser Utility Goggles",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Lesser_Utility_Goggles",
    "revisionId": 2604336,
    "revisionTimestamp": "2022-10-04T21:42:53Z",
    "ids": [
      29812
    ],
    "description": "Gain resistance, clear blindness, and remove damaging conditions.",
    "specialization": "",
    "slot": "trait",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "resistance",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Blindness",
          "Condition Removed"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Shock Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Shock_Shield",
    "revisionId": 3128689,
    "revisionTimestamp": "2026-04-15T17:54:24Z",
    "ids": [
      29840
    ],
    "description": "Block attacks while striking foes in front of you, gaining barrier with each enemy you hit.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.75",
    "recharge": "18",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "barrier",
        "values": [
          "213"
        ],
        "label": "Barrier per Hit",
        "coefficient": 0.06,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 10,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "Block Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "170"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Aim-Assisted Rocket (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Aim-Assisted_Rocket_(trait_skill)",
    "revisionId": 2753110,
    "revisionTimestamp": "2023-10-25T18:31:53Z",
    "ids": [
      29889
    ],
    "description": "Fire a seeking rocket at your foe.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Drop Gunk",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Drop_Gunk",
    "revisionId": 2300486,
    "revisionTimestamp": "2021-08-02T05:46:35Z",
    "ids": [
      29902
    ],
    "description": "Drop gunk at your location to inflict a random condition.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "ethereal"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Shredder Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Shredder_Gyro",
    "revisionId": 2917110,
    "revisionTimestamp": "2025-01-05T18:22:34Z",
    "ids": [
      29921
    ],
    "description": "Deploy a shredder gyro to attack foes near you and repeatedly use whirl finishers.",
    "specialization": "Scrapper",
    "slot": "utility",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 4.8,
        "strikes": 12,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "Strike Interval",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "Combo Interval",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "whirl"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Defense Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Defense_Field",
    "revisionId": 2609004,
    "revisionTimestamp": "2022-10-22T01:53:47Z",
    "ids": [
      30027
    ],
    "description": "Project a defensive dome around yourself and grant stability to nearby allies.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Bulwark Gyro",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "Defense Field (underwater)",
    "facts": [
      {
        "kind": "stability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "blocks missiles",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elixir Shell",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elixir_Shell",
    "revisionId": 2690111,
    "revisionTimestamp": "2023-06-28T22:46:28Z",
    "ids": [
      30032
    ],
    "description": "Launch a mortar round that heals allies in the target area.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "elixir",
    "kit": "Elite Mortar Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "24",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "370"
        ],
        "label": "",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Electro-whirl",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Electro-whirl",
    "revisionId": 2918816,
    "revisionTimestamp": "2025-01-09T09:27:21Z",
    "ids": [
      30088
    ],
    "description": "Spin around, reflecting missiles and hitting enemies.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": 2,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "reflect",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "whirl"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bulwark Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bulwark_Gyro",
    "revisionId": 2932047,
    "revisionTimestamp": "2025-02-13T14:34:36Z",
    "ids": [
      30101
    ],
    "description": "Deploy a bulwark gyro to grant barrier to allies in the area.",
    "specialization": "Scrapper",
    "slot": "utility",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Barrier",
        "values": [
          "1620"
        ],
        "label": "Initial Barrier",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "Barrier",
        "values": [
          "810"
        ],
        "label": "Pulse Barrier",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "lightning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Shell",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Shell",
    "revisionId": 2622728,
    "revisionTimestamp": "2022-12-10T13:38:59Z",
    "ids": [
      30121
    ],
    "description": "Launch a phosphorous mortar round that burns brightly at impact point.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elite Mortar Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "blind",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bandage (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bandage_(trait_skill)",
    "revisionId": 3171301,
    "revisionTimestamp": "2026-07-19T19:01:48Z",
    "ids": [
      30142
    ],
    "description": "Drop a pack of bandages that provides a little healing.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "598"
        ],
        "label": "",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "12"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Overcharge Supply Crate (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overcharge_Supply_Crate_(underwater)",
    "revisionId": 3172764,
    "revisionTimestamp": "2026-07-23T07:55:47Z",
    "ids": [
      30230
    ],
    "description": "Overcharge supply crate's turrets.",
    "specialization": "",
    "slot": "elite",
    "type": "",
    "kit": "",
    "parent": "Supply Crate (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Flashbang",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flashbang",
    "revisionId": 3090488,
    "revisionTimestamp": "2026-01-07T17:29:38Z",
    "ids": [
      30262
    ],
    "description": "Throw an explosive at the target area, dazing and blinding enemies on impact. Remove stealth and reveal enemies in a larger area around the impact.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Utility Goggles",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.05,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Revealed",
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "blindness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "daze",
        "values": [
          "1.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "600"
        ],
        "label": "Reveal Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Overcharge Supply Crate",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overcharge_Supply_Crate",
    "revisionId": 3172722,
    "revisionTimestamp": "2026-07-23T07:11:28Z",
    "ids": [
      30264
    ],
    "description": "Overcharge supply crate's turrets.",
    "specialization": "",
    "slot": "elite",
    "type": "",
    "kit": "",
    "parent": "Supply Crate",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "Overcharge Supply Crate (underwater)",
    "facts": []
  },
  {
    "page": "Chemical Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Chemical_Field",
    "revisionId": 2809397,
    "revisionTimestamp": "2024-03-16T22:10:56Z",
    "ids": [
      30279
    ],
    "description": "Generate a poison cloud.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Purge Gyro",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "poisoned",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "poison"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Endothermic Shell",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Endothermic_Shell",
    "revisionId": 2969641,
    "revisionTimestamp": "2025-05-23T12:44:21Z",
    "ids": [
      30307
    ],
    "description": "Launch a mortar round that chills foes in the target area.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elite Mortar Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "chilled",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "ice"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Medic Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Medic_Gyro",
    "revisionId": 2650014,
    "revisionTimestamp": "2023-02-04T10:49:07Z",
    "ids": [
      30357
    ],
    "description": "Deploy a medic gyro to heal yourself and nearby allies.",
    "specialization": "Scrapper",
    "slot": "healing",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "4510"
        ],
        "label": "Personal Heal",
        "coefficient": 0.7,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "460"
        ],
        "label": "Area Pulse Heal",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mortar Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mortar_Shot",
    "revisionId": 2801050,
    "revisionTimestamp": "2024-02-23T14:49:10Z",
    "ids": [
      30371
    ],
    "description": "Launch an explosive round from your mortar, damaging foes in the target area.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elite Mortar Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Equalizing Blow",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Equalizing_Blow",
    "revisionId": 2359169,
    "revisionTimestamp": "2021-10-30T18:54:20Z",
    "ids": [
      30489
    ],
    "description": "Bring down your hammer on your foe.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Positive Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Positive_Strike",
    "revisionId": 2629594,
    "revisionTimestamp": "2023-01-01T14:29:31Z",
    "ids": [
      30501
    ],
    "description": "Smack your hammer into your foe while empowering yourself.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.7,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Med Blaster",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Med_Blaster",
    "revisionId": 2810159,
    "revisionTimestamp": "2024-03-20T01:37:20Z",
    "ids": [
      30521,
      58090
    ],
    "description": "Restore health to allies with several pulses of healing energy. Heals more for each boon on the ally.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Med Kit",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "70"
        ],
        "label": "Base Healing",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "11"
        ],
        "label": "Healing for Each Boon",
        "coefficient": 0.0125,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "maximum count",
        "values": [
          "12"
        ],
        "label": "Maximum Boon Scaling",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Pulses",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Med Pack Drop (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Med_Pack_Drop_(underwater)",
    "revisionId": 2475097,
    "revisionTimestamp": "2022-03-23T21:58:21Z",
    "ids": [
      30588
    ],
    "description": "Create a set of med packs around you.",
    "specialization": "",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Supply Crate (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "60",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "1302"
        ],
        "label": "",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "14"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Orbital Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Orbital_Strike",
    "revisionId": 2633225,
    "revisionTimestamp": "2023-01-10T12:39:23Z",
    "ids": [
      30599
    ],
    "description": "Call down energy from the sky to blast an area.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Elite Mortar Kit",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Charge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Charge",
    "revisionId": 3128688,
    "revisionTimestamp": "2026-04-15T17:54:04Z",
    "ids": [
      30665
    ],
    "description": "Dash forward with a rocket-charged hammer to damage enemies.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.75",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3.6,
        "strikes": 3,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Number of Leap Finishers",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Long-Fused Powder Pack",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Long-Fused_Powder_Pack",
    "revisionId": 2363807,
    "revisionTimestamp": "2021-10-31T14:25:13Z",
    "ids": [
      30686
    ],
    "description": "Drop a delayed explosive pack at your foe's location.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion Delay",
        "values": [
          "1 second"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Thunderclap",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Thunderclap",
    "revisionId": 2784189,
    "revisionTimestamp": "2023-12-19T05:28:21Z",
    "ids": [
      30713
    ],
    "description": "Ionize an area, bringing down the power of lightning to stun foes and damage them over its duration.",
    "specialization": "Scrapper",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 4,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "hammer",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "lightning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Toss Elixir X",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Toss_Elixir_X",
    "revisionId": 2999357,
    "revisionTimestamp": "2025-07-14T04:46:16Z",
    "ids": [
      30725
    ],
    "description": "Toss your Elixir X, transforming enemies at the location into moas.",
    "specialization": "",
    "slot": "mechanic",
    "type": "tool belt, Elixir",
    "kit": "",
    "parent": "Elixir X",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "60",
    "ammo": "",
    "underwaterReplacement": "Toss Elixir X (underwater)",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Morphed (Polymorph Moa)",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Elite Mortar Kit",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Elite_Mortar_Kit",
    "revisionId": 3102027,
    "revisionTimestamp": "2026-02-02T22:46:06Z",
    "ids": [
      30800
    ],
    "description": "Equip the mortar kit.",
    "specialization": "",
    "slot": "elite",
    "type": "Engineering Kit",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": []
  },
  {
    "page": "Sneak Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sneak_Gyro",
    "revisionId": 2788879,
    "revisionTimestamp": "2024-01-10T13:16:41Z",
    "ids": [
      30815
    ],
    "description": "Deploy a sneak gyro to provide stealth to nearby allies.",
    "specialization": "Scrapper",
    "slot": "elite",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "45",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Stealth",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "pulses",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "smoke"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      }
    ]
  },
  {
    "page": "Poison Gas Shell",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Poison_Gas_Shell",
    "revisionId": 2361187,
    "revisionTimestamp": "2021-10-31T09:13:10Z",
    "ids": [
      30885
    ],
    "description": "Launch a mortar round that spreads poisonous gas in an area.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Elite Mortar Kit",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "poisoned",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "poison"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Spare Capacitor",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Spare_Capacitor",
    "revisionId": 3171353,
    "revisionTimestamp": "2026-07-19T19:35:54Z",
    "ids": [
      31167
    ],
    "description": "Set down a lightning capacitor to daze and damage foes near it.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Shredder Gyro",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "24",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.2,
        "strikes": 4,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "daze alt",
        "values": [
          "2"
        ],
        "label": "First Pulse",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "lightning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blast Gyro",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blast_Gyro",
    "revisionId": 2776618,
    "revisionTimestamp": "2023-12-07T03:36:10Z",
    "ids": [
      31248
    ],
    "description": "Unleash a blast gyro to begin a countdown to a tremendous blast.",
    "specialization": "Scrapper",
    "slot": "utility",
    "type": "well",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.75,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Might",
        "values": [
          "15"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "pulse",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Blast Delay",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "fire"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Detonate Rocket Turret (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Rocket_Turret_(underwater)",
    "revisionId": 2358796,
    "revisionTimestamp": "2021-10-30T17:58:23Z",
    "ids": [
      38748
    ],
    "description": "Detonate your rocket turret.",
    "specialization": "",
    "slot": "utility",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Detonate Supply Crate Turrets (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Detonate_Supply_Crate_Turrets_(underwater)",
    "revisionId": 3172765,
    "revisionTimestamp": "2026-07-23T07:56:06Z",
    "ids": [
      38750
    ],
    "description": "Detonate your supply crate turrets.",
    "specialization": "",
    "slot": "elite",
    "type": "",
    "kit": "",
    "parent": "Supply Crate (underwater)",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Radiant Arc",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Radiant_Arc",
    "revisionId": 3128687,
    "revisionTimestamp": "2026-04-15T17:53:32Z",
    "ids": [
      40160
    ],
    "description": "Leap to your target and create an arc of light that strikes nearby foes. Gain quickness based on your heat level.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "quickness",
        "values": [
          "2"
        ],
        "label": "Quickness at or below 50% heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "quickness",
        "values": [
          "4"
        ],
        "label": "Quickness over 50% heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "crippled",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Throw Junk (Doppelganger)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Throw_Junk_(Doppelganger)",
    "revisionId": 2362833,
    "revisionTimestamp": "2021-10-31T12:22:32Z",
    "ids": [
      40168
    ],
    "description": "Throw a bit of junk and inflict a random condition on your foe.",
    "specialization": "",
    "slot": "",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "0.25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.33,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "chilled",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "weakness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "9000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Coolant Blast",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Coolant_Blast",
    "revisionId": 2690618,
    "revisionTimestamp": "2023-06-29T19:30:04Z",
    "ids": [
      40507
    ],
    "description": "Heal yourself and chill nearby foes. If you are above the heat threshold when this skill is activated, gain Frost Aura and continue healing for a duration.",
    "specialization": "holosmith",
    "slot": "healing",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "4740"
        ],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat threshold",
        "values": [
          "50"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "chilled",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Cooling Vapor",
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Frost Aura (effect)",
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Launch Wall",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Launch_Wall",
    "revisionId": 2840070,
    "revisionTimestamp": "2024-06-29T08:56:26Z",
    "ids": [
      40533
    ],
    "description": "Launch your photon wall forward, causing the wall to explode when it strikes a foe, inflicting conditions on nearby enemies. When fired above the heat threshold, launch additional walls.",
    "specialization": "holosmith",
    "slot": "utility",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "0.5",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat threshold",
        "values": [
          "50"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Additional Walls",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "blocks missiles",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Deactivate Photon Forge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Deactivate_Photon_Forge",
    "revisionId": 2695016,
    "revisionTimestamp": "2023-07-12T10:27:04Z",
    "ids": [
      41123
    ],
    "description": "Cancel Photon Forge and begin cooling after a delay. Cooling effectiveness increases over time.",
    "specialization": "Holosmith",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "Photon Projector",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "heat gain",
        "values": [
          "5"
        ],
        "label": "Heat Lost per Second",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "heat gain",
        "values": [
          "10"
        ],
        "label": "Improved Heat Lost per Second",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Cooling Delay",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Spectrum Shield",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Spectrum_Shield",
    "revisionId": 2784690,
    "revisionTimestamp": "2023-12-22T20:59:00Z",
    "ids": [
      41218
    ],
    "description": "Break stun effects and create a holographic shell that reduces incoming damage and grants stability. This skill grants more stability and lasts longer while above the heat threshold.",
    "specialization": "holosmith",
    "slot": "utility",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Spectrum Shield (effect)",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stability",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Orbital Command Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Orbital_Command_Strike",
    "revisionId": 2616306,
    "revisionTimestamp": "2022-11-19T08:46:41Z",
    "ids": [
      41612
    ],
    "description": "Call down energy from the sky to blast an area.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.92,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Cutter—Storm",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Cutter%E2%80%94Storm",
    "revisionId": 2653637,
    "revisionTimestamp": "2023-02-05T18:46:43Z",
    "ids": [
      41684
    ],
    "description": "Fire two light blades in quick succession.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.6,
        "strikes": 2,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Prismatic Singularity",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Prismatic_Singularity",
    "revisionId": 2690624,
    "revisionTimestamp": "2023-06-29T19:31:06Z",
    "ids": [
      41843
    ],
    "description": "Collapse a ring of holograms to pull foes into a single point. The ring explodes when it fully collapses. Radius and pull distance increased while above the heat threshold.",
    "specialization": "holosmith",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Hard Light Arena",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Pull Damage",
        "coefficient": 0.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Explosion Damage",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "pull",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius increase",
        "values": [
          "120"
        ],
        "label": "Radius and Pull Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blast Radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Prime Light Beam",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Prime_Light_Beam",
    "revisionId": 2990848,
    "revisionTimestamp": "2025-06-27T03:59:11Z",
    "ids": [
      42009
    ],
    "description": "Charge up and fire an explosive beam of light in front of you. When activated above the heat threshold, this attack leaves behind a burning holographic field.",
    "specialization": "Holosmith",
    "slot": "elite",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "60",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Field Damage",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "heat threshold",
        "values": [
          "50"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "Field Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "launch",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "Field Pulses",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "10"
        ],
        "label": "Field Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Blade Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Blade_Burst",
    "revisionId": 2840040,
    "revisionTimestamp": "2024-06-29T08:23:21Z",
    "ids": [
      42163
    ],
    "description": "Fire holographic blades at foes within range. Damage increased while over the heat threshold.",
    "specialization": "holosmith",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Laser Disk",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "damage increase",
        "values": [
          "25"
        ],
        "label": "Damage Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bright Slash—Storm",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bright_Slash%E2%80%94Storm",
    "revisionId": 2653635,
    "revisionTimestamp": "2023-02-05T18:45:27Z",
    "ids": [
      42475
    ],
    "description": "Launch another arc of light at your target.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Holographic Shockwave",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Holographic_Shockwave",
    "revisionId": 2991438,
    "revisionTimestamp": "2025-06-28T01:58:18Z",
    "ids": [
      42521
    ],
    "description": "Create a deadly holographic shockwave that launches foes upward. This attack always deals a critical hit.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "critical chance increase",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "launch",
        "values": [
          "0"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Laser Disk",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Laser_Disk",
    "revisionId": 2840069,
    "revisionTimestamp": "2024-06-29T08:56:03Z",
    "ids": [
      42842
    ],
    "description": "Create rotating laser blades to damage nearby foes. This skill has increased duration when activated while above the heat threshold.",
    "specialization": "holosmith",
    "slot": "utility",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulse",
        "values": [
          "12"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration increase",
        "values": [
          "50%"
        ],
        "label": "Duration Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Engage Photon Forge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Engage_Photon_Forge",
    "revisionId": 2690606,
    "revisionTimestamp": "2023-06-29T19:26:12Z",
    "ids": [
      42938
    ],
    "description": "Activate your Photon Forge, gaining access to new skills. Generate heat while Photon Forge is active. Take damage if you overheat. Disables use of kits for a short duration.",
    "specialization": "Holosmith",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "Photon Projector",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "Heat per Second",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Heat Threshold",
        "values": [
          "100"
        ],
        "label": "Maximum Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "6"
        ],
        "label": "Kit disable time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Holo Leap",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Holo_Leap",
    "revisionId": 2690610,
    "revisionTimestamp": "2023-06-29T19:27:50Z",
    "ids": [
      42965
    ],
    "description": "Create a holographic launch pad and leap to your foe. The pad remains behind for a short duration, granting increased movement speed to allies who touch it.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "2",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "7"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "swiftness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Spark",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Spark",
    "revisionId": 3027438,
    "revisionTimestamp": "2025-09-10T15:04:07Z",
    "ids": [
      43176
    ],
    "description": "Release a blinding burst of light from your holographic emitter. While above the heat threshold, gain light aura.",
    "specialization": "holosmith",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Spectrum Shield",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "blind",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Light Aura",
          "4"
        ],
        "label": "Light Aura above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Sun Edge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sun_Edge",
    "revisionId": 2842794,
    "revisionTimestamp": "2024-07-08T05:02:28Z",
    "ids": [
      43476
    ],
    "description": "Strike your foe and inflict vulnerability. This attack deals more damage based on your heat level.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.88,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage increase",
        "values": [
          "20"
        ],
        "label": "Damage Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Vent Exhaust",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Vent_Exhaust",
    "revisionId": 3026832,
    "revisionTimestamp": "2025-09-08T22:43:10Z",
    "ids": [
      43630
    ],
    "description": "Damage nearby foes and apply conditions to them. Lose heat. This attack activates Heat Therapy if you have not overheated.",
    "specialization": "holosmith",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "15"
        ],
        "label": "Heat Lost",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Cannot Critical Hit",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Photon Wall",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Photon_Wall",
    "revisionId": 2810205,
    "revisionTimestamp": "2024-03-20T02:51:32Z",
    "ids": [
      43739
    ],
    "description": "A defensive barrier appears in front of you that blocks you and your allies from incoming attacks. Reactivate Exceed to fire the barrier at foes as an attack. This skill grants projectile reflection if you are above the heat threshold.",
    "specialization": "holosmith",
    "slot": "utility",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Heat Threshold",
        "values": [
          "50"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blocks Missiles",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "reflect",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Cauterize",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Cauterize",
    "revisionId": 3027126,
    "revisionTimestamp": "2025-09-09T20:03:37Z",
    "ids": [
      43845
    ],
    "description": "Use a laser to burn off conditions and set yourself on fire for each condition removed. Removes additional conditions if above the heat threshold.",
    "specialization": "holosmith",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Coolant Blast",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Heat Threshold",
        "values": [
          "50"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "Self Burning per Condition",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Conditions Removed",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Conditions Removed",
        "values": [
          "3"
        ],
        "label": "Additional Conditions above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Overheat",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overheat",
    "revisionId": 2848977,
    "revisionTimestamp": "2024-08-12T20:39:40Z",
    "ids": [
      43937
    ],
    "description": "Reaching the heat maximum results in a self-damaging explosion. Photon Forge is disabled until all heat is lost. Other tool belt skill cooldowns are increased.",
    "specialization": "Holosmith",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "health loss",
        "values": [
          "3981"
        ],
        "label": "Base Health Damage",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "health loss",
        "values": [
          "796"
        ],
        "label": "Base Health Damage over Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "recharge time",
        "values": [
          "15"
        ],
        "label": "Increased Tool Belt Recharge",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Refraction Cutter",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Refraction_Cutter",
    "revisionId": 2827747,
    "revisionTimestamp": "2024-05-23T14:31:44Z",
    "ids": [
      44110
    ],
    "description": "Strike at foes in front of you and launch a blade of light at your target. Launch extra blades based on your heat level. Each blade inflicts conditions.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Projectile Damage",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Additional Blades over 50% heat",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "Projectile Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Light Strike—Storm",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Light_Strike%E2%80%94Storm",
    "revisionId": 2794212,
    "revisionTimestamp": "2024-02-09T10:41:00Z",
    "ids": [
      44260
    ],
    "description": "Launch an arc of light at your foe.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Holoforge Overheated",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Holoforge_Overheated",
    "revisionId": 2282071,
    "revisionTimestamp": "2021-06-27T14:02:13Z",
    "ids": [
      44386
    ],
    "description": "Unable to reactivate until cooled.",
    "specialization": "Holosmith",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Corona Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Corona_Burst",
    "revisionId": 3128700,
    "revisionTimestamp": "2026-04-15T18:07:53Z",
    "ids": [
      44530
    ],
    "description": "Strike nearby foes and begin to store up energy, gaining boons and heat each pulse. After charging, the energy explodes, inflicting conditions on nearby foes.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Initial Damage",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Explosion Damage",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Hits",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulse",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Light Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Light_Strike",
    "revisionId": 2917226,
    "revisionTimestamp": "2025-01-06T07:25:09Z",
    "ids": [
      44588
    ],
    "description": "Swing a holographic blade.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Hard Light Arena",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Hard_Light_Arena",
    "revisionId": 3122736,
    "revisionTimestamp": "2026-04-04T05:42:23Z",
    "ids": [
      44646
    ],
    "description": "Create a holographic arena that grants you boons while inside of it. When activated above the heat threshold, the radius is increased and the user is granted barrier. Allies gain boons at reduced duration.",
    "specialization": "holosmith",
    "slot": "utility",
    "type": "Exceed",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "35",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "barrier",
        "values": [
          "2900"
        ],
        "label": "Barrier Applied above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "fury",
        "values": [
          "2",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "protection",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "Boon Application Interval",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration increase",
        "values": [
          "50%"
        ],
        "label": "Ally Boon Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius increase",
        "values": [
          "120"
        ],
        "label": "Radius Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "light"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Refraction Cutter Blade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Refraction_Cutter_Blade",
    "revisionId": 2656396,
    "revisionTimestamp": "2023-02-16T15:34:22Z",
    "ids": [
      45119
    ],
    "description": "Launch a blade of light that bleeds your target.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "Refraction Cutter",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.275,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Deactivate Photon Forge (hot)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Deactivate_Photon_Forge_(hot)",
    "revisionId": 2695017,
    "revisionTimestamp": "2023-07-12T10:27:48Z",
    "ids": [
      45219
    ],
    "description": "Cancel Photon Forge and begin cooling after a delay. Cooling effectiveness increases over time.",
    "specialization": "Holosmith",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "Photon Projector",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "heat gain",
        "values": [
          "5"
        ],
        "label": "Heat Lost per Second",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "heat gain",
        "values": [
          "10"
        ],
        "label": "Improved Heat Lost per Second",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Cooling Delay",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Sun Ripper",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sun_Ripper",
    "revisionId": 2827750,
    "revisionTimestamp": "2024-05-23T14:33:21Z",
    "ids": [
      45581
    ],
    "description": "Strike your foe again and inflict vulnerability. This attack deals more damage based on your heat level.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.93,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage increase",
        "values": [
          "20"
        ],
        "label": "Damage Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Controlled Analysis",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Controlled_Analysis",
    "revisionId": 2828131,
    "revisionTimestamp": "2024-05-24T07:41:35Z",
    "ids": [
      45709
    ],
    "description": "Analyze a disabled foe, applying vulnerability.",
    "specialization": "",
    "slot": "trait",
    "type": "Tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "fury",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 10,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Revealed",
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Particle Accelerator",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Particle_Accelerator",
    "revisionId": 2840072,
    "revisionTimestamp": "2024-06-29T08:58:11Z",
    "ids": [
      45732
    ],
    "description": "Fire a crippling bolt of light at your target. Allies the bolt passes through are granted swiftness. Projectile velocity and damage increased while above the heat threshold.",
    "specialization": "holosmith",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Photon Wall",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage increase",
        "values": [
          "10"
        ],
        "label": "Damage Increase Above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "swiftness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "crippled",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Velocity Increase Above 50% Heat",
        "values": [
          "100%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1000"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Bright Slash",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Bright_Slash",
    "revisionId": 2363550,
    "revisionTimestamp": "2021-10-31T13:49:24Z",
    "ids": [
      45756
    ],
    "description": "Slash with a blade of light energy.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Photon Blitz",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Photon_Blitz",
    "revisionId": 3128701,
    "revisionTimestamp": "2026-04-15T18:08:17Z",
    "ids": [
      45783
    ],
    "description": "Fire multiple piercing blasts at your target.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 5.12,
        "strikes": 8,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile",
          "y"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flash Cutter",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flash_Cutter",
    "revisionId": 2690609,
    "revisionTimestamp": "2023-06-29T19:27:36Z",
    "ids": [
      45890
    ],
    "description": "Cleave through all foes in front of you twice.",
    "specialization": "Holosmith",
    "slot": "transform",
    "type": "",
    "kit": "",
    "parent": "Engage Photon Forge",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.6,
        "strikes": 2,
        "stacks": null,
        "interval": null,
        "weapon": "transform",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "heat gain",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Gleam Saber",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Gleam_Saber",
    "revisionId": 2827749,
    "revisionTimestamp": "2024-05-23T14:32:16Z",
    "ids": [
      45979
    ],
    "description": "Unleash a burst of stored energy with your sword and recharge your other sword skills. This attack deals more damage based on your heat level.",
    "specialization": "Holosmith",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage increase",
        "values": [
          "20"
        ],
        "label": "Damage Increase above 50% Heat",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Recharge Time Reduced",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Cleansing Field",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Cleansing_Field",
    "revisionId": 2603717,
    "revisionTimestamp": "2022-10-04T17:53:19Z",
    "ids": [
      49045
    ],
    "description": "Release purifying vapors to cleanse conditions from allies near you at each interval.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Med Kit",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "conditions removed",
        "values": [
          "1"
        ],
        "label": "Conditions Removed per Pulse",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Pulse",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "water"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Vital Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Vital_Burst",
    "revisionId": 2707837,
    "revisionTimestamp": "2023-07-18T16:58:08Z",
    "ids": [
      49082
    ],
    "description": "Unleash a cascade of concentrated healing vapors around you.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Med Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Healing",
        "values": [
          "942"
        ],
        "label": "",
        "coefficient": 1.03,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Lesser Elixir C",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Lesser_Elixir_C",
    "revisionId": 3121259,
    "revisionTimestamp": "2026-03-30T08:53:02Z",
    "ids": [
      49097
    ],
    "description": "Quaff an elixir, converting conditions into boons.",
    "specialization": "",
    "slot": "trait",
    "type": "elixir",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Conditions Converted to Boons",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Capture Line",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Capture_Line",
    "revisionId": 2837693,
    "revisionTimestamp": "2024-06-23T08:33:54Z",
    "ids": [
      50380
    ],
    "description": "Cast out a towline and drag your foe toward you.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "harpoon gun",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pull",
        "values": [
          "600"
        ],
        "label": "Pull Distance",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Boots (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Boots_(underwater)",
    "revisionId": 2790321,
    "revisionTimestamp": "2024-01-19T18:13:10Z",
    "ids": [
      50438,
      50441
    ],
    "description": "Fly forward, removing movement-impairing conditions and damaging foes with your rocket exhaust.<br>{{gray|Movement-impairing conditions include cripple, chill, and immobilize.}}",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "2",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "condition",
        "values": [
          "Crippled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Chilled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Immobile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "maximum count",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "count recharge",
        "values": [
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Rocket Distance",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Infusion Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Infusion_Bomb",
    "revisionId": 2811045,
    "revisionTimestamp": "2024-03-25T16:28:37Z",
    "ids": [
      50444
    ],
    "description": "Throw a bomb that grants boons to nearby allies when it explodes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Med Kit",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "swiftness",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vigor",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "regeneration",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "duration",
        "values": [
          "1"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Slick Shoes (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Slick_Shoes_(underwater)",
    "revisionId": 2650232,
    "revisionTimestamp": "2023-02-04T21:38:15Z",
    "ids": [
      50491
    ],
    "description": "Spray oil behind you, knocking down foes. If underwater, foes entering the field are blinded and slowed.",
    "specialization": "",
    "slot": "utility",
    "type": "gadget",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "blind",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "slow",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Number of Hits per Target",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "Oil Slick Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Function Gyro (tool belt skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Function_Gyro_(tool_belt_skill)",
    "revisionId": 2952397,
    "revisionTimestamp": "2025-04-05T15:54:59Z",
    "ids": [
      56920,
      56921
    ],
    "description": "Create a lightning field at the specified point. Then summon gyros to finish foes and revive allies within the field. The recharge of this skill is increased for each gyro created beyond the first.<br>{{gray|Interrupted gyros are destroyed.}}",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "percent",
        "values": [
          "50"
        ],
        "label": "Recharge increase per gyro",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "Field Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "lightning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Explosive Entrance (trait skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Explosive_Entrance_(trait_skill)",
    "revisionId": 3135336,
    "revisionTimestamp": "2026-04-26T16:28:43Z",
    "ids": [
      59562
    ],
    "description": "Your first attack explodes, dealing extra damage to nearby enemies.",
    "specialization": "",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "0.25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rectifier Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rectifier_Signet",
    "revisionId": 2767820,
    "revisionTimestamp": "2023-11-28T22:08:43Z",
    "ids": [
      63049
    ],
    "description": "{{Skill type|Signet Passive|:}} Heal yourself and your mech every second.<br>{{Skill type|Signet Active|:}} Heal yourself and your mech.",
    "specialization": "Mechanist",
    "slot": "healing",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "healing",
        "values": [
          "262"
        ],
        "label": "Heal Pulse",
        "coefficient": 0.05,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "6500"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Crash Down",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Crash_Down",
    "revisionId": 3126757,
    "revisionTimestamp": "2026-04-09T10:00:40Z",
    "ids": [
      63050
    ],
    "description": "Summon your jade mech at the target area. Foes in the area are damaged. The recharge time of this skill is based on how damaged your mech is. <br \\> {{gray|Right-click to rename your mech.}}",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 4,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "50",
    "ammo": "",
    "underwaterReplacement": "Mech Support: Depth Charges",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "launch",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "recharge time",
        "values": [
          "10"
        ],
        "label": "Minimum Recharge",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "recharge time",
        "values": [
          "50"
        ],
        "label": "Maximum Recharge",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mace Smash (mechanist)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mace_Smash_(mechanist)",
    "revisionId": 2726386,
    "revisionTimestamp": "2023-08-27T16:00:50Z",
    "ids": [
      63077
    ],
    "description": "Smash your target with a heavy blow from your mace, inflicting confusion.",
    "specialization": "Mechanist",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "mace",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "mace",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Recall Mech",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Recall_Mech",
    "revisionId": 2695921,
    "revisionTimestamp": "2023-07-15T17:39:09Z",
    "ids": [
      63089,
      63300
    ],
    "description": "Recall your mech for repairs. The cooldown of Crash Down is determined by the amount of damage your mech has taken.<br>{{gray|Right-click to rename your mech.}}",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 4,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "10",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "recharge time reduced",
        "values": [
          "5"
        ],
        "label": "Minimum Recharge",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "recharge time reduced",
        "values": [
          "50"
        ],
        "label": "Maximum Recharge",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Overclock Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Overclock_Signet",
    "revisionId": 2730906,
    "revisionTimestamp": "2023-08-30T19:28:41Z",
    "ids": [
      63095
    ],
    "description": "{{Skill type|Signet Passive|:}} Reduces recharge of other signets.<br>{{Skill type|Signet Active|:}} Order your mech to fire its ultimate weapon, the jade buster cannon. If your mech is not present, instead your mech is summoned, even if Crash Down is on cooldown.",
    "specialization": "Mechanist",
    "slot": "elite",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "90",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "Recharge Reduced",
        "values": [
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Shift Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Shift_Signet",
    "revisionId": 2982620,
    "revisionTimestamp": "2025-06-14T16:24:55Z",
    "ids": [
      63111
    ],
    "description": "{{Skill type|Signet Passive|:}} Increases movement speed. Boons you gain are copied to your mech.<br>{{Skill type|Signet Active|:}} You and your mech Shadowstep to the target location. Removes conditions on you and your mech.",
    "specialization": "Mechanist",
    "slot": "utility",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "conditions removed",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Movement Speed Increase",
        "values": [
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Superconducting Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Superconducting_Signet",
    "revisionId": 3043552,
    "revisionTimestamp": "2025-10-25T05:34:13Z",
    "ids": [
      63113
    ],
    "description": "{{Skill type|Signet Passive|:}} Increases condition damage dealt.<br>{{Skill type|Signet Active|:}} Creates a damaging field around you that applies conditions to nearby foes. If your mech is active, the field instead radiates from and follows the mech.",
    "specialization": "Mechanist",
    "slot": "utility",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.4,
        "strikes": 6,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Superconducting Signet (effect)"
        ],
        "label": "Signet Passive",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "confusion",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "lightning"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Jade Mortar",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Jade_Mortar",
    "revisionId": 3128117,
    "revisionTimestamp": "2026-04-14T19:13:29Z",
    "ids": [
      63121
    ],
    "description": "Launch a powerful mortar attack at the target.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 3,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "daze",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1500"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Barrier Burst",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Barrier_Burst",
    "revisionId": 2882226,
    "revisionTimestamp": "2024-10-08T22:30:48Z",
    "ids": [
      63141
    ],
    "description": "Pulse a barrier and boons to all nearby allies.<br>{{gray|The mech does not count against the target count for this skill.}}",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 3,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "3.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "barrier",
        "values": [
          "454"
        ],
        "label": "Barrier per Pulse",
        "coefficient": 0.575,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "20"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "fury",
        "values": [
          "3",
          "25"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pulses",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Energizing Slam",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Energizing_Slam",
    "revisionId": 3171237,
    "revisionTimestamp": "2026-07-19T16:26:13Z",
    "ids": [
      63169
    ],
    "description": "Leap forward and smash the ground, inflicting conditions on foes while granting barrier and boons to allies.",
    "specialization": "Mechanist",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "mace",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.85,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "mace",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "barrier",
        "values": [
          "648"
        ],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vigor",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "regeneration",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Aerial Support",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Aerial_Support",
    "revisionId": 3126755,
    "revisionTimestamp": "2026-04-09T09:42:39Z",
    "ids": [
      63172
    ],
    "description": "...",
    "specialization": "Mechanist",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "trait",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mace Blast",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mace_Blast",
    "revisionId": 2792935,
    "revisionTimestamp": "2024-02-01T13:30:23Z",
    "ids": [
      63174
    ],
    "description": "Smash your target with a final heavy strike, inflicting additional confusion.",
    "specialization": "Mechanist",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "mace",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "mace",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Punch (Mech)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Punch_(Mech)",
    "revisionId": 2957463,
    "revisionTimestamp": "2025-04-16T22:20:04Z",
    "ids": [
      63185
    ],
    "description": "Your mech launches an explosive fist that detonates on hit, dealing defiance damage to enemies with active defiance bars. This skill is only used when you activate Skill 3 on your weapon.",
    "specialization": "Mechanist",
    "slot": "trait",
    "type": "",
    "kit": "",
    "parent": "Rocket Fist Prototype",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "5",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Bonus Defiance Damage",
        "values": [
          "1 second"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mace Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mace_Strike",
    "revisionId": 2753935,
    "revisionTimestamp": "2023-10-29T08:15:00Z",
    "ids": [
      63186
    ],
    "description": "Strike your target.",
    "specialization": "Mechanist",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "mace",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "mace",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Spark Revolver",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Spark_Revolver",
    "revisionId": 2940541,
    "revisionTimestamp": "2025-03-10T22:49:36Z",
    "ids": [
      63188
    ],
    "description": "Fire a rapid volley of jade energy bolts from both arms, piercing through all enemies.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.112,
        "strikes": 12,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Mech Support: Depth Charges",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mech_Support%3A_Depth_Charges",
    "revisionId": 2747479,
    "revisionTimestamp": "2023-10-01T09:58:55Z",
    "ids": [
      63210
    ],
    "description": "Request a barrage from your mech on the target foe.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 4,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Missiles Fired",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blast Radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rocket Fist Prototype",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rocket_Fist_Prototype",
    "revisionId": 3171238,
    "revisionTimestamp": "2026-07-19T16:27:48Z",
    "ids": [
      63234
    ],
    "description": "Launch a fist that explodes on the first target hit, damaging and stunning nearby enemies.",
    "specialization": "Mechanist",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "mace",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "12",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "mace",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "100"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Sky Circus",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sky_Circus",
    "revisionId": 3087934,
    "revisionTimestamp": "2026-01-02T04:25:01Z",
    "ids": [
      63236
    ],
    "description": "Your mech jets into the air and fires a missile at each nearby foe before crashing down and dealing additional damage to anything caught underfoot.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 3,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Missile Damage",
        "coefficient": 0.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Landing Damage",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "launch",
        "values": [
          "100"
        ],
        "label": "Knockback on Landing",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Targets per Missile",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "Missile Explosion Radius",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Force Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Force_Signet",
    "revisionId": 2956326,
    "revisionTimestamp": "2025-04-15T17:43:52Z",
    "ids": [
      63253
    ],
    "description": "{{Skill type|Signet Passive|:}} Increases strike damage dealt.<br>{{Skill type|Signet Active|:}} Knock foes away from yourself and away from your mech.",
    "specialization": "Mechanist",
    "slot": "utility",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Force Signet (effect)"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "cripple",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "knockback",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Barrier Signet",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Barrier_Signet",
    "revisionId": 2695496,
    "revisionTimestamp": "2023-07-14T10:38:40Z",
    "ids": [
      63262
    ],
    "description": "{{Skill type|Signet Passive|:}} Incoming strike and condition damage is reduced.<br>{{Skill type|Signet Active|:}} Create a projectile-blocking dome around yourself. You and allies inside the dome gain barrier every second. If your mech is active, the dome is centered on it and is larger.<br>{{gray|The mech does not count against the target count for this skill.}}",
    "specialization": "Mechanist",
    "slot": "utility",
    "type": "Signet",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "barrier",
        "values": [
          "326"
        ],
        "label": "Barrier per Pulse",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Barrier Signet (effect)"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Blocks Missiles",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Pulses",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius increase",
        "values": [
          "60"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Heavy Smash (Mech)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Heavy_Smash_(Mech)",
    "revisionId": 2655539,
    "revisionTimestamp": "2023-02-14T20:48:47Z",
    "ids": [
      63263
    ],
    "description": "Perform a second, powerful strike.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.45,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Jade Energy Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Jade_Energy_Shot",
    "revisionId": 2956329,
    "revisionTimestamp": "2025-04-15T17:46:49Z",
    "ids": [
      63264,
      63348
    ],
    "description": "...",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Twin Strike (Mech)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Twin_Strike_(Mech)",
    "revisionId": 2655825,
    "revisionTimestamp": "2023-02-15T09:15:18Z",
    "ids": [
      63288
    ],
    "description": "Strikes foes in front of you.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": 2,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Crisis Zone",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Crisis_Zone",
    "revisionId": 2932059,
    "revisionTimestamp": "2025-02-13T15:03:57Z",
    "ids": [
      63293
    ],
    "description": "Your mech removes conditions, breaks stuns, and grants boons to itself and nearby allies.<br>{{gray|The mech does not count against the target count for this skill.}}",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 2,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "aegis",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "protection",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "alacrity",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Hard Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Hard_Strike",
    "revisionId": 2655538,
    "revisionTimestamp": "2023-02-14T20:47:51Z",
    "ids": [
      63298
    ],
    "description": "Strikes foes in front of you.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.25",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.45,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rolling Smash",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rolling_Smash",
    "revisionId": 2598457,
    "revisionTimestamp": "2022-09-30T12:09:54Z",
    "ids": [
      63334
    ],
    "description": "Slam at the target with both cutters, inflicting severe bleeding to enemies in the area.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.6,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 4,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Core Reactor Shot",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Core_Reactor_Shot",
    "revisionId": 3087929,
    "revisionTimestamp": "2026-01-02T04:21:51Z",
    "ids": [
      63345
    ],
    "description": "Charge up and then release a powerful ball of jade energy at your target that explodes on contact.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 2,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "launch",
        "values": [
          "240",
          ""
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "232"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Explosive Knuckle",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Explosive_Knuckle",
    "revisionId": 2569134,
    "revisionTimestamp": "2022-07-30T11:08:13Z",
    "ids": [
      63365
    ],
    "description": "Order your mech to dash at a target, punching with an explosive strike that weakens enemies near the point of impact.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "weakness",
        "values": [
          "5",
          ""
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [
          ""
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Discharge Array",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Discharge_Array",
    "revisionId": 2747462,
    "revisionTimestamp": "2023-10-01T09:43:01Z",
    "ids": [
      63367
    ],
    "description": "Cycle energy into your mech's armor to turn it into a lightning rod. Jade energy strikes nearby foes and inflicts conditions on them.",
    "specialization": "Mechanist",
    "slot": "mechanic",
    "type": "Mech Command, tool belt",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 2,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "30",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "slow",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "confusion",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Hits",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Jade Buster Cannon",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Jade_Buster_Cannon",
    "revisionId": 2630465,
    "revisionTimestamp": "2023-01-03T19:48:23Z",
    "ids": [
      63374
    ],
    "description": "Fire the main cannon, obliterating targets in a line. The mech may swivel to track targets while firing the Jade Buster cannon, but it is unable to move.",
    "specialization": "mechanist",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "Overclock Signet",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "3.25",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 4.75,
        "strikes": 5,
        "stacks": null,
        "interval": null,
        "weapon": "pet",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rifle Burst Grenade",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rifle_Burst_Grenade",
    "revisionId": 2956315,
    "revisionTimestamp": "2025-04-15T17:39:11Z",
    "ids": [
      68079
    ],
    "description": "Fire an explosive grenade from your rifle.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "rifle",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "120"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Defense Field (underwater)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Defense_Field_(underwater)",
    "revisionId": 2812532,
    "revisionTimestamp": "2024-03-31T20:01:55Z",
    "ids": [
      68280
    ],
    "description": "Project a defensive dome and grant stability to allies in the area.",
    "specialization": "Scrapper",
    "slot": "mechanic",
    "type": "tool belt",
    "kit": "",
    "parent": "Bulwark Gyro",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "stability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "blocks missiles",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "allied targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Radiant Arc (non-holosmith)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Radiant_Arc_(non-holosmith)",
    "revisionId": 3081550,
    "revisionTimestamp": "2025-12-20T13:56:28Z",
    "ids": [
      69565
    ],
    "description": "Leap to your target and create an arc of light that strikes nearby foes. Gain quickness.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "14",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "quickness",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "crippled",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Sun Ripper (non-holosmith)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sun_Ripper_(non-holosmith)",
    "revisionId": 2736164,
    "revisionTimestamp": "2023-09-07T17:28:20Z",
    "ids": [
      69906
    ],
    "description": "Strike your foe again and inflict vulnerability.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.02,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Sun Edge (non-holosmith)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Sun_Edge_(non-holosmith)",
    "revisionId": 2842795,
    "revisionTimestamp": "2024-07-08T05:03:21Z",
    "ids": [
      70514
    ],
    "description": "Strike your foe and inflict vulnerability.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.96,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "10"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Gleam Saber (non-holosmith)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Gleam_Saber_(non-holosmith)",
    "revisionId": 2816739,
    "revisionTimestamp": "2024-04-24T07:17:03Z",
    "ids": [
      70771
    ],
    "description": "Unleash a burst of stored energy with your sword and recharge your other sword skills.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.65,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Recharge Time Reduced",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Refraction Cutter (non-holosmith)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Refraction_Cutter_(non-holosmith)",
    "revisionId": 2991540,
    "revisionTimestamp": "2025-06-28T07:14:19Z",
    "ids": [
      71121
    ],
    "description": "Strike at foes in front of you and launch two blades of light at your target. Each blade inflicts conditions.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "sword",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "6",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Projectile Damage",
        "coefficient": 0.4,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "sword",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "Projectile Range",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Essence of Liquid Wrath",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Essence_of_Liquid_Wrath",
    "revisionId": 3072622,
    "revisionTimestamp": "2025-12-04T10:35:29Z",
    "ids": [
      71870
    ],
    "description": "Fire a volley of arrows equipped with a payload that spreads magical flames across the ground on impact, granting boons to allies on the initial detonation and leaving a fire field. <br><br>Chain Reaction. The next short-bow skill in the radius will grant additional protection to allies.",
    "specialization": "",
    "slot": "weapon",
    "type": "Chain Reaction",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.32,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "protection",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "aegis",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "protection",
        "values": [
          "3"
        ],
        "label": "Chain Reaction Protection",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Chain Reaction Availability Window",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "fire"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Arc Detonator",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Arc_Detonator",
    "revisionId": 2839967,
    "revisionTimestamp": "2024-06-29T05:16:27Z",
    "ids": [
      71873
    ],
    "description": "Fire an arrow equipped with an electric module that discharges when striking your target, shocking them and two nearby enemies with an electric blast.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Shock Damage",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "Shock Targets",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Essence of Living Shadows",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Essence_of_Living_Shadows",
    "revisionId": 3155127,
    "revisionTimestamp": "2026-06-03T18:05:50Z",
    "ids": [
      71882
    ],
    "description": "Fire an arrow equipped with a device that spreads shadow magic across the ground on impact, healing and removing conditions from allies with the initial detonation, and healing allies with each pulse afterward. <br><br>Chain Reaction. The next short-bow skill in the radius will remove additional conditions from allies.",
    "specialization": "",
    "slot": "weapon",
    "type": "Chain Reaction",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "970"
        ],
        "label": "Initial Heal",
        "coefficient": 0.45,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "healing",
        "values": [
          "645"
        ],
        "label": "Pulse Heal",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "2"
        ],
        "label": "Chain Reaction Conditions Removed",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Chain Reaction Availability Window",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "dark"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Essence of Borrowed Time",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Essence_of_Borrowed_Time",
    "revisionId": 2814830,
    "revisionTimestamp": "2024-04-13T23:24:17Z",
    "ids": [
      71888
    ],
    "description": "Fire a row of arrows equipped with a device that envelops an area with chronal magic on impact, stunning enemies and applying superspeed to allies.<br><br>Chain Reaction. The next short-bow skill in the radius will daze enemies hit.",
    "specialization": "",
    "slot": "weapon",
    "type": "Chain Reaction",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "daze",
        "values": [
          "2"
        ],
        "label": "Chain Reaction Daze",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Chain Reaction Availability Window",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Essence of Animated Sand",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Essence_of_Animated_Sand",
    "revisionId": 3154825,
    "revisionTimestamp": "2026-06-03T10:19:29Z",
    "ids": [
      72052
    ],
    "description": "Fire an arrow equipped with a payload that explodes enchanted sand on impact, granting barrier and might to allies.<br><br>Chain Reaction. The next short-bow skill in the radius will grant additional might to allies.",
    "specialization": "",
    "slot": "weapon",
    "type": "Chain Reaction",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "8",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "shortbow",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "barrier",
        "values": [
          "1285"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "Chain Reaction Might",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "pvp"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "Chain Reaction Availability Window",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "1200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Puncturing Jab",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Puncturing_Jab",
    "revisionId": 3021095,
    "revisionTimestamp": "2025-08-25T14:38:28Z",
    "ids": [
      72944
    ],
    "description": "Stab your foe, inflicting bleeding. Inflict vulnerability if your target is focused.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.45,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Devastator",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Devastator",
    "revisionId": 3092469,
    "revisionTimestamp": "2026-01-13T21:06:50Z",
    "ids": [
      72974
    ],
    "description": "Traverse the area and unleash lighting{{sic|should be 'lightning'}} around you, directly targeting focused foes a number of times.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 3,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Roiling Skies",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Roiling_Skies",
    "revisionId": 3021100,
    "revisionTimestamp": "2025-08-25T14:38:39Z",
    "ids": [
      72977
    ],
    "description": "Charge the earth with electricity, launching focused foes and stunning others.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "15",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "cripple",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "launch",
        "values": [
          "40"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "432"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "range",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Amplifying Slice",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Amplifying_Slice",
    "revisionId": 3021022,
    "revisionTimestamp": "2025-08-25T14:36:04Z",
    "ids": [
      73001
    ],
    "description": "Strike your foe, refreshing your focus and bleeding your target. Inflict vulnerability if your target is focused.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.99,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Lightning Rod (engineer spear skill)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Lightning_Rod_(engineer_spear_skill)",
    "revisionId": 3036137,
    "revisionTimestamp": "2025-10-03T07:53:13Z",
    "ids": [
      73002
    ],
    "description": "Prime your lightning rod to deal damage to nearby enemies. Focused enemies receive extra punishment. Gain charges for your Electric Artillery skill.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Focused Target Damage",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.17,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "Focused Target Vulnerability",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "Unfocused Target Vulnerability",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Lightning Rod Charges",
          "14"
        ],
        "label": "Charges per target struck.",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Maximum Stacks",
        "values": [
          "12"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Number of Impacts",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Focused Devastation",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Focused_Devastation",
    "revisionId": 3138156,
    "revisionTimestamp": "2026-05-10T18:04:11Z",
    "ids": [
      73064
    ],
    "description": "Repeatedly strike your foe, inflicting conditions.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 5,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.2,
        "strikes": 6,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 6,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Number of Hits",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Rending Strike",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Rending_Strike",
    "revisionId": 3021097,
    "revisionTimestamp": "2025-08-25T14:38:33Z",
    "ids": [
      73109
    ],
    "description": "Swing your spear, inflicting bleeding. Inflict vulnerability if your target is focused.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 1,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.65,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "130"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Conduit Surge",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Conduit_Surge",
    "revisionId": 3128684,
    "revisionTimestamp": "2026-04-15T17:50:48Z",
    "ids": [
      73122
    ],
    "description": "Leap toward your target, unleashing intense energy on the area if you strike them. Your primary target becomes the focus of your other skills. If a focused target dies, this skill is refreshed.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 2,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "5",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Focused Target Damage",
        "coefficient": 1.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Unfocused Target Damage",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "7"
        ],
        "label": "Focused Target Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "Unfocused Target Burning",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Focusing",
          "10"
        ],
        "label": "Focused Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "leap"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "450"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Electric Artillery",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Electric_Artillery",
    "revisionId": 3128685,
    "revisionTimestamp": "2026-04-15T17:52:32Z",
    "ids": [
      73143
    ],
    "description": "Hurl your charged rod at a foe, immobilizing them. Foes take increased burning duration and vulnerability stacks based on your lightning rod's charge.",
    "specialization": "",
    "slot": "weapon",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": 3,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "1",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Focused Target Damage",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "spear",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "0.5"
        ],
        "label": "Focused Burning Duration Increase per Charge",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "0.25"
        ],
        "label": "Unfocused Burning Duration Increase per Charge",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "Charges Required per Vulnerability on Focused Targets",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "Charges Required per Vulnerability on Unfocused Targets",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "3"
        ],
        "label": "Minimum Burning Duration",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "immobilize",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "180"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Stoke the Flames",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Stoke_the_Flames",
    "revisionId": 3128692,
    "revisionTimestamp": "2026-04-15T17:56:16Z",
    "ids": [
      76493
    ],
    "description": "Overcharge your flamethrower with a fuel injection, releasing a burst of flames around you as you grant yourself boons.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Flamethrower",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": []
      },
      {
        "kind": "burning",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 2,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "quickness",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "fire"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Magnetic Bomb",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Magnetic_Bomb",
    "revisionId": 2991200,
    "revisionTimestamp": "2025-06-27T20:24:45Z",
    "ids": [
      76530
    ],
    "description": "Set a timed charge that pulls nearby foes.",
    "specialization": "",
    "slot": "engineering kit",
    "type": "",
    "kit": "Bomb Kit",
    "parent": "",
    "weaponSlot": 4,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 1.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "kit",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "pull",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "2"
        ],
        "label": "Fuse Time",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Explosion",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Symbiotic Shielding",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Symbiotic_Shielding",
    "revisionId": 3169694,
    "revisionTimestamp": "2026-07-16T17:41:27Z",
    "ids": [
      76613
    ],
    "description": "Gain barrier and magnetic aura.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Tool belt",
    "kit": "",
    "parent": "Mitotic State",
    "weaponSlot": null,
    "mechanicSlot": 1,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "barrier",
        "values": [
          "2250"
        ],
        "label": "",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Magnetic Aura (effect)",
          "4"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Evolve",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Evolve",
    "revisionId": 3161506,
    "revisionTimestamp": "2026-06-19T05:55:19Z",
    "ids": [
      76642,
      76651
    ],
    "description": "Evolve.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": 5,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "40",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Attribute Increase",
        "values": [
          "10%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": 3,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Evolved",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Mitotic State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Mitotic_State",
    "revisionId": 3154873,
    "revisionTimestamp": "2026-06-03T10:37:03Z",
    "ids": [
      76738
    ],
    "description": "Your slime stimulates your cells to regenerate, healing you rapidly over time. The healing is increased while you have barrier.",
    "specialization": "Amalgam",
    "slot": "healing",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "Increase with Barrier",
        "values": [
          "20%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "healing",
        "values": [
          "7625"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve",
          "wvw"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Mitotic State (effect)",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Locked (amalgam)",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Locked_(amalgam)",
    "revisionId": 3077152,
    "revisionTimestamp": "2025-12-14T21:43:57Z",
    "ids": [
      76790,
      77107,
      77388
    ],
    "description": "Select a skill using the arrow above.",
    "specialization": "Amalgam",
    "slot": "",
    "type": "",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": []
  },
  {
    "page": "Defensive Protocol: Cleanse",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Defensive_Protocol%3A_Cleanse",
    "revisionId": 3102839,
    "revisionTimestamp": "2026-02-03T23:30:33Z",
    "ids": [
      76798,
      77285,
      76713
    ],
    "description": "Convert damaging conditions to barrier and nondamaging conditions to protection.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "barrier",
        "values": [
          "805"
        ],
        "label": "",
        "coefficient": 0.2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "protection",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "conditions removed",
        "values": [
          "3"
        ],
        "label": "Damaging Conditions Converted",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "conditions removed",
        "values": [
          "3"
        ],
        "label": "Nondamaging Conditions Converted",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "text",
        "values": [
          "Replicating Strain. Evolving heals you over time and grants alacrity."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Replicating Strain",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "alacrity",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Offensive Protocol: Obliterate",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Offensive_Protocol%3A_Obliterate",
    "revisionId": 3102078,
    "revisionTimestamp": "2026-02-02T23:48:31Z",
    "ids": [
      76806,
      76901,
      76705
    ],
    "description": "Create a giant blade to maim your enemy. The attack destroys the barrier of enemies hit.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.88,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "Break Barrier",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "bleeding",
        "values": [
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Titanic Strain. Evolving improves the effect of might and grants might."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Titanic Strain",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "might",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 10,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "attribute",
        "values": [
          "Power",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "attribute",
        "values": [
          "Condition Damage",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      }
    ]
  },
  {
    "page": "Offensive Protocol: Pierce",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Offensive_Protocol%3A_Pierce",
    "revisionId": 3102845,
    "revisionTimestamp": "2026-02-03T23:34:20Z",
    "ids": [
      76815,
      77005,
      77015
    ],
    "description": "Thrust forward with a spike, piercing the defense of your foe.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.88,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "vulnerability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 8,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "unblockable",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "170"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Volatile Strain. When you evolve, stun nearby enemies."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "400"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Liquid State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Liquid_State",
    "revisionId": 3101990,
    "revisionTimestamp": "2026-02-02T22:42:46Z",
    "ids": [
      76908
    ],
    "description": "Quickly melt down into a puddle, evading all incoming attacks.",
    "specialization": "Amalgam",
    "slot": "utility",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.8,
        "strikes": 4,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": []
      },
      {
        "kind": "poison",
        "values": [
          "12"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 4,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "crippled",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 4,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "evade",
        "values": [
          "1.75"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Offensive Protocol: Demolish",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Offensive_Protocol%3A_Demolish",
    "revisionId": 3102850,
    "revisionTimestamp": "2026-02-03T23:36:23Z",
    "ids": [
      76927,
      76693,
      76954
    ],
    "description": "Spin around a hunk of metal, then finish with a forward smash.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.25",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.7,
        "strikes": 3,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Smash Damage",
        "coefficient": 2.25,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "whirl"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Berserker Strain. Evolving grants you stability and heals you based on a percentage of damage dealt to enemies."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Berserker Strain",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stability",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Defensive Protocol: Protect",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Defensive_Protocol%3A_Protect",
    "revisionId": 3102840,
    "revisionTimestamp": "2026-02-03T23:31:52Z",
    "ids": [
      76959,
      77203,
      77358
    ],
    "description": "Briefly block incoming attacks.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1.5",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "duration",
        "values": [
          "1.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Resiliant{{sic|should be Resilient}} Strain. Evolving grants you barrier and resistance."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "barrier",
        "values": [
          "4850"
        ],
        "label": "",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "resistance",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Flux State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Flux_State",
    "revisionId": 3101985,
    "revisionTimestamp": "2026-02-02T22:42:36Z",
    "ids": [
      76993
    ],
    "description": "Your slime rapidly spins around you, creating a magnetic field. Pull in nearby enemies as a metallic storm swirls around you.",
    "specialization": "amalgam",
    "slot": "elite",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "50",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Storm Damage",
        "coefficient": 9,
        "strikes": 12,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "bleeding",
        "values": [
          "5"
        ],
        "label": "Storm Bleeding",
        "coefficient": null,
        "strikes": null,
        "stacks": 12,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "Pull",
        "values": [
          "360"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "150"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Gaseous State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Gaseous_State",
    "revisionId": 3101987,
    "revisionTimestamp": "2026-02-02T22:42:40Z",
    "ids": [
      77018
    ],
    "description": "Sublimate, breaking stun from yourself. Remove movement-impairing conditions and prevent their reapplication.",
    "specialization": "Amalgam",
    "slot": "utility",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "effect",
        "values": [
          "Gaseous State (effect)",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "condition",
        "values": [
          "Crippled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Chilled"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "condition",
        "values": [
          "Immobile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Solid State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Solid_State",
    "revisionId": 3102004,
    "revisionTimestamp": "2026-02-02T22:43:14Z",
    "ids": [
      77069
    ],
    "description": "Leap into the air as you command your body to compact, stunning enemies upon landing. Gain stability and increase your outgoing stun durations for a duration.",
    "specialization": "Amalgam",
    "slot": "utility",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "none",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "stability",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 5,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Solid State (effect)",
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "stun",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "duration increase",
        "values": [
          "33%"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "combo",
        "values": [
          "blast"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "defiance break",
        "values": [
          "200"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "600"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Offensive Protocol: Shred",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Offensive_Protocol%3A_Shred",
    "revisionId": 3102848,
    "revisionTimestamp": "2026-02-03T23:35:21Z",
    "ids": [
      77103,
      76866,
      76568
    ],
    "description": "Launch cutting disks at your enemies, piercing enemies in their path. Enemies struck are crippled; if an enemy is struck by all three disks, they are immobilized instead.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "1",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 2.88,
        "strikes": 3,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "crippled",
        "values": [
          "2"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "immobile",
        "values": [
          "3"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "pierces",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "900"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Predator Strain. Evolving grants you superspeed and quickness."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Superspeed",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "quickness",
        "values": [
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "combo",
        "values": [
          "projectile"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Defensive Protocol: Thorns",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Defensive_Protocol%3A_Thorns",
    "revisionId": 3169695,
    "revisionTimestamp": "2026-07-16T17:44:51Z",
    "ids": [
      77163,
      77104,
      76640
    ],
    "description": "Grow protective spikes, damaging nearby enemies. For a short duration, the spikes react when you are struck, damaging nearby enemies again.",
    "specialization": "Amalgam",
    "slot": "mechanic",
    "type": "Morph",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0",
    "recharge": "20",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "Initial Damage",
        "coefficient": 1,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "damage",
        "values": [],
        "label": "Thorns Damage",
        "coefficient": 0.5,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "effect",
        "values": [
          "Thorns",
          "6"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "1"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "radius",
        "values": [
          "240"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "text",
        "values": [
          "Rapacious Strain. While evolved, strike foes an additional time when you hit them."
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 0.3,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "unequipped",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Rapacious Strain",
          "8"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "interval",
        "values": [
          "0.5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "breaks stun",
        "values": [],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  },
  {
    "page": "Plasmatic State",
    "sourceUrl": "https://wiki.guildwars2.com/wiki/Plasmatic_State",
    "revisionId": 3101999,
    "revisionTimestamp": "2026-02-02T22:43:04Z",
    "ids": [
      77209
    ],
    "description": "Superheat your body and lash out, damaging and burning enemies struck. Your outgoing strike and condition damage is increased for a duration.",
    "specialization": "Amalgam",
    "slot": "utility",
    "type": "Stance",
    "kit": "",
    "parent": "",
    "weaponSlot": null,
    "mechanicSlot": null,
    "mainhand": "",
    "offhand": "",
    "weapon": "",
    "activation": "0.75",
    "recharge": "25",
    "ammo": "",
    "underwaterReplacement": "",
    "facts": [
      {
        "kind": "damage",
        "values": [],
        "label": "",
        "coefficient": 4.5,
        "strikes": 2,
        "stacks": null,
        "interval": null,
        "weapon": "utility",
        "gameModes": [
          "pve"
        ]
      },
      {
        "kind": "burning",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": 4,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "effect",
        "values": [
          "Plasmatic State (effect)",
          "7"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "targets",
        "values": [
          "5"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      },
      {
        "kind": "range",
        "values": [
          "300"
        ],
        "label": "",
        "coefficient": null,
        "strikes": null,
        "stacks": null,
        "interval": null,
        "weapon": "",
        "gameModes": []
      }
    ]
  }
];

export const WIKI_SKILL_RESEARCH_BY_ID = new Map(
  WIKI_SKILL_RESEARCH.flatMap(skill =>
    skill.ids.map(id => [id, skill])),
);
