import { WEAPON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
/** Sword weapon-skill mechanics owned by the Weaver module. */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.TWIN_STRIKE]: {
    name: 'Twin Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    cooldown: 10,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
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
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
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
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    cooldown: 18,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
    castTimeMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
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
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
    castTimeMs: 640,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 8 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2.5 }
    ])
  },
  [ID.NATURAL_FRENZY]: {
    name: 'Natural Frenzy',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    cooldown: 10,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
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
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    specialization: 'Weaver',
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
