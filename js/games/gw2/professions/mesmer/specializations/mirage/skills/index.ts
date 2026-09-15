/**
 * Owns Mirage slot-skill, ambush, and simulator-action catalog data.
 * Mirage Cloak, mirror, and ambush runtime behavior lives under `mechanics/`.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';

export const MESMER_MIRAGE_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.FALSE_OASIS]: {
    // Use the observed Quickness cast as the timing reference.
    castTimeMs: 960,
    // The oasis starts pulsing during the cast; its mirror appears three seconds after that first pulse.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    effects: []
  },
  [ID.CRYSTAL_SANDS]: {
    castTimeMs: 371,
    // The launched sand and its mirror survive cancellation of the remaining animation.
    interruptCommitMs: 320,
    // The ground mirror appears when the sand projectiles converge, after their damage packets.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 1160,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 6,
        atMs: 320,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'confusion', stacks: 6, duration: 4 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIRAGE_ADVANCE]: {
    shadowstepSkill: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      { type: 'condition', condition: 'Blinded', stacks: 1, duration: 5 },

      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      }
    ]
  },
  [ID.SAND_THROUGH_GLASS]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    // These instant Deceptions grant Mirage Cloak when their cast completes.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.ILLUSIONARY_AMBUSH]: {
    shadowstepSkill: true,
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.JAUNT]: {
    shadowstepSkill: true,
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0.5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 3
      }
    ]
  }
});

/** One skill record owns catalog metadata and both actor variants; profiles and runtime reuse it. */
export const MESMER_MIRAGE_AMBUSH_SKILLS: Readonly<Record<string, MesmerAmbushAttack>> = Object.freeze({
  Axe: {
    id: ID.IMAGINARY_AXES,
    name: 'Imaginary Axes',
    icon: 'https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png',
    description: 'Ambush. Release phantasmal axes that seek out the nearest target after a short delay.',
    castTimeMs: 440,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    // Cancelling the aftercast preserves axes already released at the player packet's impact frame.
    interruptCommitMs: 360,
    effects: [],
    player: {
      coefficient: 1,
      hits: 2,
      atMs: 0,
      damageAtMs: 360,
      conditions: [
        {
          name: 'Torment',
          duration: 3.5,
          stacks: 3,
          applications: 2
        }
      ]
    },
    clone: {
      coefficient: 3.7,
      hits: 2,
      atMs: 0,
      castTimeMs: 1110,
      conditions: [
        {
          name: 'Torment',
          duration: 4,
          stacks: 1
        }
      ]
    }
  },
  Dagger: {
    id: ID.PHANTOM_RAZOR,
    name: 'Phantom Razor',
    icon: 'https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png',
    description: 'Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.',
    castTimeMs: 600,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    effects: [],
    player: {
      coefficient: 3,
      hits: 3,
      atMs: 0,
      conditions: [
        {
          name: 'Bleeding',
          duration: 5,
          stacks: 2
        },
        {
          name: 'Torment',
          duration: 5,
          stacks: 2
        }
      ]
    },
    clone: {
      coefficient: 3,
      hits: 3,
      atMs: 0,
      castTimeMs: 0,
      conditions: [
        {
          name: 'Bleeding',
          duration: 7,
          stacks: 1
        },
        {
          name: 'Torment',
          duration: 7,
          stacks: 1
        }
      ]
    }
  },
  Greatsword: {
    id: ID.SPLIT_SURGE,
    name: 'Split Surge',
    icon: 'https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png',
    description: 'Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.',
    castTimeMs: 960,
    cooldown: 0.5,
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    // Each beam and its statuses survive only if they land before the channel is interrupted.
    interruptMode: 'per-packet',
    effects: [],
    player: {
      ticks: [
        { atMs: 360, coefficient: 3.1875 / 3 },
        { atMs: 520, coefficient: 3.1875 / 3 },
        { atMs: 680, coefficient: 3.1875 / 3 }
      ],
      boons: [
        {
          name: 'Might',
          duration: 5,
          stacks: 2
        }
      ]
    },
    clone: {
      coefficient: 3.1875,
      hits: 3,
      atMs: 0
    },
    vulnerability: {
      duration: 5,
      stacks: 2
    }
  },
  Rifle: {
    id: ID.EFFERVESCENCE,
    name: 'Effervescence',
    icon: 'https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png',
    description: 'Ambush. Spray invigorating magic, damaging enemies and healing allies.',
    castTimeMs: 166.666666667,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    effects: [],
    player: {
      coefficient: 2.6,
      hits: 4,
      atMs: 0,
      boons: [
        {
          name: 'Vigor',
          duration: 4,
          stacks: 1
        }
      ]
    },
    clone: {
      coefficient: 1.2,
      hits: 4,
      atMs: 0
    }
  },
  Scepter: {
    id: ID.ETHER_BARRAGE,
    name: 'Ether Barrage',
    icon: 'https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png',
    description: 'Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment.',
    castTimeMs: 1000,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    effects: [],
    player: {
      coefficient: 1.25,
      hits: 5,
      atMs: 0,
      conditions: [
        {
          name: 'Confusion',
          duration: 4,
          stacks: 2
        },
        {
          name: 'Torment',
          duration: 4,
          stacks: 3
        }
      ]
    },
    clone: {
      coefficient: 3.75,
      hits: 5,
      atMs: 0,
      conditions: [
        {
          name: 'Confusion',
          duration: 2,
          stacks: 2
        },
        {
          name: 'Torment',
          duration: 2,
          stacks: 3
        }
      ]
    }
  },
  Spear: {
    id: ID.FRACTURED_GLASS,
    name: 'Fractured Glass',
    icon: 'https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png',
    description: 'Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.',
    castTimeMs: 880,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    interruptMode: 'per-packet',
    effects: [],
    player: {
      // Fractured Glass applies one strike and one Vulnerability stack at each measured packet.
      ticks: [400, 480, 520, 560, 640, 720, 760].map((atMs) => ({ atMs, coefficient: 3.15 / 7 }))
    },
    clone: {
      coefficient: 3.15,
      hits: 7,
      atMs: 0
    },
    vulnerability: {
      duration: 6,
      stacks: 1
    }
  },
  Staff: {
    id: ID.CHAOS_VORTEX,
    name: 'Chaos Vortex',
    icon: 'https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png',
    description:
      'Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.',
    castTimeMs: 720,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    effects: [],
    player: {
      coefficient: 0.6,
      hits: 1,
      atMs: 0,
      conditions: [
        {
          name: 'Bleeding',
          duration: 10,
          stacks: 1
        },
        {
          name: 'Torment',
          duration: 10,
          stacks: 1
        },
        {
          name: 'Confusion',
          duration: 10,
          stacks: 1
        }
      ],
      boons: [
        {
          name: 'Might',
          duration: 15,
          stacks: 2
        },
        {
          name: 'Fury',
          duration: 2,
          stacks: 1
        }
      ]
    },
    clone: {
      coefficient: 1.12,
      hits: 1,
      atMs: 0,
      conditions: [
        {
          name: 'Bleeding',
          duration: 4,
          stacks: 1
        },
        {
          name: 'Torment',
          duration: 4,
          stacks: 1
        },
        {
          name: 'Confusion',
          duration: 3,
          stacks: 1
        }
      ],
      boons: [
        {
          name: 'Might',
          duration: 15,
          stacks: 2
        },
        {
          name: 'Fury',
          duration: 2,
          stacks: 1
        }
      ]
    }
  },
  Sword: {
    id: ID.MIRAGE_THRUST,
    name: 'Mirage Thrust',
    icon: 'https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png',
    description: 'Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.',
    castTimeMs: 500,
    cooldown: 1,
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    player: {
      coefficient: 3,
      hits: 1,
      atMs: 0
    },
    clone: {
      coefficient: 3,
      hits: 1,
      atMs: 0
    },
    createsClone: true
  }
});

export const MESMER_MIRAGE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  ...Object.values(MESMER_MIRAGE_AMBUSH_SKILLS),
  {
    id: ID.DODGE_MIRAGE_CLOAK,
    name: 'Dodge / Mirage Cloak',
    description:
      'Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    castTimeMs: 0,
    cooldown: 0,
    resourceCost: 50,
    // Mirage dodge spends endurance, grants cloak, and resolves dodge-triggered traits at completion.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.dodge',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  {
    id: ID.PICK_UP_MIRAGE_MIRROR,
    name: 'Pick Up Mirage Mirror',
    description: 'Pick up an available Mirage Mirror, damaging nearby enemies and gaining Mirage Cloak.',
    icon: 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    castTimeMs: 0,
    cooldown: 0,
    // Picking up the action consumes the available ground mirror at cast completion.
    mechanicTriggers: [
      {
        type: 'mesmer.mirage.pick-up-mirror',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);
