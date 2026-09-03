/**
 * Mirage-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

import type { MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';

export const MESMER_MIRAGE_AMBUSH_ATTACKS: Readonly<Record<string, MesmerAmbushAttack>> = Object.freeze({
  Axe: {
    id: ID.IMAGINARY_AXES,
    name: 'Imaginary Axes',
    icon: 'https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png',
    description: 'Ambush. Release phantasmal axes that seek out the nearest target after a short delay.',
    castTimeMs: 780,
    cooldown: 1,
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
    castTimeMs: 750,
    cooldown: 1,
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
    castTimeMs: 1440,
    cooldown: 0.5,
    player: {
      ticks: [
        { atMs: 360, coefficient: 3.1875 / 3 },
        { atMs: 520, coefficient: 3.1875 / 3 },
        { atMs: 680, coefficient: 3.1875 / 3 }
      ]
    },
    clone: {
      coefficient: 3.1875,
      hits: 3,
      atMs: 0
    },
    playerBoons: [
      {
        name: 'Might',
        duration: 5,
        stacks: 2
      }
    ],
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
    castTimeMs: 250,
    cooldown: 1,
    player: {
      coefficient: 2.6,
      hits: 4,
      atMs: 0
    },
    clone: {
      coefficient: 1.2,
      hits: 4,
      atMs: 0
    },
    playerBoons: [
      {
        name: 'Vigor',
        duration: 4,
        stacks: 1
      }
    ]
  },
  Scepter: {
    id: ID.ETHER_BARRAGE,
    name: 'Ether Barrage',
    icon: 'https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png',
    description:
      'Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment. Condition duration is halved for clones.',
    castTimeMs: 1500,
    cooldown: 1,
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
    castTimeMs: 1320,
    cooldown: 1,
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
    castTimeMs: 1000,
    cooldown: 1,
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
      ]
    },
    playerBoons: [
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
    ],
    cloneBoons: [
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
  Sword: {
    id: ID.MIRAGE_THRUST,
    name: 'Mirage Thrust',
    icon: 'https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png',
    description: 'Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.',
    castTimeMs: 750,
    cooldown: 1,
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
    createsClone: true,
    control: true
  }
});
export const MESMER_MIRAGE_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([ID.MIRAGE_ADVANCE, ID.MIRAGE_THRUST]);
export const MESMER_MIRAGE_BLIND_SKILLS: ReadonlySet<number> = new Set<number>([ID.MIRAGE_ADVANCE]);
export const MESMER_MIRAGE_PEITHA_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.FALSE_OASIS,
  ID.CRYSTAL_SANDS,
  ID.MIRAGE_ADVANCE,
  ID.SAND_THROUGH_GLASS,
  ID.ILLUSIONARY_AMBUSH,
  ID.JAUNT
]);
export const MESMER_MIRAGE_PEITHA_PROJECTILE_DELAYS: Readonly<Record<number, number>> = Object.freeze({
  [ID.CRYSTAL_SANDS]: 0.241,
  [ID.JAUNT]: 0.241
});
