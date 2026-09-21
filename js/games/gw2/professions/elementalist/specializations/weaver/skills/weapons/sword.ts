/** Sword weapon-skill mechanics owned by the Weaver module. */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TWIN_STRIKE]: {
    name: 'Twin Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, metadata: {} }
      ]),
      ...impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.5 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 8, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  [ID.PYRO_VORTEX]: {
    name: 'Pyro Vortex',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1840, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2560, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 3280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  [ID.LAVA_SKIN]: {
    name: 'Lava Skin',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 400,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1240, 2240, 3240, 4240, 5240].map((atMs) => ({ atMs, coefficient: 0.33, damageKind: 'field-tick' }))
      },
      {
        type: 'condition',
        ticks: [1240, 2240, 3240, 4240, 5240].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 1 })),
        metadata: {}
      }
    ]),
    specialization: 'Weaver'
  },
  [ID.SHEARING_EDGE]: {
    name: 'Shearing Edge',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 8, metadata: {} },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 2.5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.NATURAL_FRENZY]: {
    name: 'Natural Frenzy',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 1400,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1160, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.44 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 1.5, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  [ID.GALE_STRIKE]: {
    name: 'Gale Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 720,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]),
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]),
      ...impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]),
      ...impactEffects({ atMs: 1720, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]),
      ...impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275, canCrit: true },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ])
    ],
    specialization: 'Weaver'
  }
});
