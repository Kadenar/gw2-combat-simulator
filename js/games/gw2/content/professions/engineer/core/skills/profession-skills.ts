/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Core toolbelt skill fragments and their parent-slot relationships. */
export const ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TOSS_ELIXIR_R]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 90,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.TOSS_ELIXIR_B]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'Stability',
        duration: 4,
        stacks: 3
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir B'
  },
  [ID.TOSS_ELIXIR_C]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 16,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.TOSS_ELIXIR_U]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_S]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.SUPERSPEED_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [],
    toolbeltParentName: 'Slick Shoes'
  },
  [ID.TOSS_ELIXIR_H]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 4,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir H',
    mechanicSlot: 1
  },
  [ID.LAUNCH_PERSONAL_BATTERING_RAM]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Launch Personal Battering Ram',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Personal Battering Ram'
  },
  [ID.ROCKET_KICK]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Kick',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 8,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rocket Boots'
  },
  [ID.TOSS_ELIXIR_C_ID_6077]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 16,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.DETONATE_ELIXIR_C]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir C'
  },
  [ID.DETONATE_ELIXIR_B]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir B'
  },
  [ID.DETONATE_ELIXIR_S]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.DETONATE_ELIXIR_R]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.DETONATE_ELIXIR_U]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_U_ID_6089]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Elixir U'
  },
  [ID.TOSS_ELIXIR_S_ID_6090]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Elixir S'
  },
  [ID.TOSS_ELIXIR_R_ID_6091]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 90,
    effects: [],
    toolbeltParentName: 'Elixir R'
  },
  [ID.TOSS_ELIXIR_B_ID_6092]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'Stability',
        duration: 4,
        stacks: 3
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Elixir B'
  },
  [ID.DETONATE_ELIXIR_H]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir H'
  },
  [ID.MINE_FIELD]: {
    implemented: true,
    handlerId: 'engineer.mine-field',
    quicknessCastTimeMs: 920,
    cooldown: 17,
    effects: [
      {
        type: 'strike',
        coefficient: 3.85,
        hits: 5,
        name: 'Damage per Mine',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 },
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.DETONATE_MINE_FIELD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.77,
        hits: 1,
        name: 'Damage per Mine',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          skillName: 'Mine Field'
        }
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2.5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Throw Mine'
  },
  [ID.REGENERATING_MIST]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 18,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 2
      }
    ],
    toolbeltParentName: 'Healing Turret',
    mechanicSlot: 1
  },
  [ID.ROCKET]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Rocket',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rocket Turret'
  },
  [ID.SURPRISE_SHOT_ENGINEER_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Surprise Shot (engineer skill)',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Rifle Turret'
  },
  [ID.NET_ATTACK]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 38,
    effects: [],
    toolbeltParentName: 'Net Turret'
  },
  [ID.RUMBLE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 38,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rumble',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Thumper Turret'
  },
  [ID.THROW_NAPALM]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    // The impact starts a three-second fire field; its later pulses burn once per second without extra strikes.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 120.24, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Throw Napalm',
        actorType: 'player',
        comboFields: [
          {
            ownerId: 'engineer',
            fieldType: 'Fire',
            duration: 3,
            startAnchor: 'event',
            inclusiveExpiry: true
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        atMs: 120.24,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        applications: 3,
        atMs: 1120.24,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Flame Turret'
  },
  [ID.HARPOON_ENGINEER_SKILL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Harpoon (engineer skill)',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Harpoon Turret'
  },
  [ID.CONFUSING_SPEECH]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Technobabble'
  },
  [ID.PAIN_TRANSFERENCE]: {
    implemented: true,
    castTimeMs: 1250,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Pain Transference',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Pain Inverter'
  },
  [ID.VENT_RADIATION]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 9,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Radiation Field'
  },
  [ID.INVIGORATING_ROAR]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 50,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Battle Roar'
  },
  [ID.BOOBY_TRAP_CHARR_SKILL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Booby Trap (charr skill)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Shrapnel Mine'
  },
  [ID.HIDDEN_PISTOLS]: {
    implemented: true,
    castTimeMs: 1750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Hidden Pistols',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Hidden Pistol'
  },
  [ID.BLESSING_OF_DWAYNA]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 40,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Prayer to Dwayna',
    mechanicSlot: 1
  },
  [ID.BLESSING_OF_KORMIR]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 30,
    effects: [],
    toolbeltParentName: 'Prayer to Kormir'
  },
  [ID.BLESSING_OF_LYSSA]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 35,
    effects: [],
    toolbeltParentName: 'Prayer to Lyssa'
  },
  [ID.EAT_WURM_EGG]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 6,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Call Wurm'
  },
  [ID.EAT_OWL_EGG]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Call Owl'
  },
  [ID.THROW_VINE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 45,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Throw Vine',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ],
    toolbeltParentName: 'Seed Turret'
  },
  [ID.VINE_SHIELD]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 45,
    effects: [],
    toolbeltParentName: 'Grasping Vines'
  },
  [ID.LEAFY_BANDAGE]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 40,
    effects: [],
    toolbeltParentName: 'Healing Seed',
    mechanicSlot: 1
  },
  [ID.STATIC_SHOCK]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Static Shock',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'control',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ],
    toolbeltParentName: 'A.E.D.',
    mechanicSlot: 1
  },
  [ID.MED_PACK_DROP]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 50,
    effects: [],
    toolbeltParentName: 'Supply Crate',
    mechanicSlot: 5
  },
  [ID.DETONATE_ELIXIR_X]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    toolbeltParentName: 'Elixir X (underwater)'
  },
  [ID.FLASHBANG]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Flashbang',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1.5
        }
      }
    ],
    toolbeltParentName: 'Utility Goggles'
  },
  [ID.TOSS_ELIXIR_X]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 60,
    effects: [],
    toolbeltParentName: 'Elixir X',
    mechanicSlot: 5
  }
});
