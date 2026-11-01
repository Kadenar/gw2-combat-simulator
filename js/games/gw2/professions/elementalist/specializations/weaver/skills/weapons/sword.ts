/** Sword weapon-skill mechanics owned by the Weaver module. */
import { CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.TWIN_STRIKE]: {
    name: 'Twin Strike',
    description: 'Dual Attack. Quickly strike enemies in front of you with the extreme nature of fire and water.',
    icon: 'https://render.guildwars2.com/file/A9AF29CA2FF6925E30299CFC9B41317128132CF1/1770378.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Water',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
      ]),
      ...impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.5 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 }
      ])
    ]
  },
  [ID.PYRO_VORTEX]: {
    name: 'Pyro Vortex',
    description: 'Dual Attack. Strike enemies in an arc in front of you, creating burning vortexes on enemies you hit.',
    icon: 'https://render.guildwars2.com/file/04720B7D45462D026116FBE03B931730AE45F319/1770376.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Air',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    effects: [
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 2200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 2560, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 2920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 3280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ])
    ]
  },
  [ID.LAVA_SKIN]: {
    name: 'Lava Skin',
    description: 'Dual Attack. Cover yourself in an increasing barrier while dealing damage to nearby enemies.',
    icon: 'https://render.guildwars2.com/file/C328476928DFDE7FF3C2F65143FC7852C3F69CF9/1770377.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 400,
    interruptCommitMs: 320,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [1240, 2240, 3240, 4240, 5240].map((atMs) => ({ atMs, coefficient: 0.33, damageKind: 'field-tick' }))
      },
      {
        type: 'condition',
        ticks: [1240, 2240, 3240, 4240, 5240].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1
        }))
      }
    ])
  },
  [ID.SHEARING_EDGE]: {
    name: 'Shearing Edge',
    description: 'Dual Attack. Form a frozen blade and spin it toward your enemies.',
    icon: 'https://render.guildwars2.com/file/0902076456CC210BBFA6EF1D07AEDD17F694CF0F/1770380.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Air+Water',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 8 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2.5 }
    ])
  },
  [ID.NATURAL_FRENZY]: {
    name: 'Natural Frenzy',
    description: 'Dual Attack. Unleash a volley of ice and earth at your enemies.',
    icon: 'https://render.guildwars2.com/file/040D09DE34ECA5207298BFE60DAF75173A3DA371/1770374.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Water+Earth',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 1400,
    effects: [
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ]),
      ...impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 1.5 }
      ])
    ]
  },
  [ID.GALE_STRIKE]: {
    // The initial lift disables once; cyclone damage does not repeatedly trigger disable procs.
    name: 'Gale Strike',
    description: 'Dual Attack. Strike your enemies, lifting them and creating cyclones at their locations.',
    icon: 'https://render.guildwars2.com/file/BB51AAF648980C472D14E03003ED17AAED5B24E9/1770373.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Air+Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 720,
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 },
        { type: 'control', applications: 1, controlKind: CONTROL.FLOAT }
      ]),
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }
      ]),
      ...impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }
      ]),
      ...impactEffects({ atMs: 1720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }
      ]),
      ...impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }
      ])
    ]
  }
});
