/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// The axe chain uses reviewed 440/520/720 ms activations to keep its completion packets aligned.
export const MESMER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MIRROR_STRIKES]: {
    castTimeMs: 720,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 6,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.AXES_OF_SYMMETRY]: {
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    // Both weapon variants are shadowsteps and use the same movement-relic projectile timing.
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        atMs: 920,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5,
        atMs: -80
      }
    ],
    castTimeMs: 1000
  },
  [ID.LACERATING_CHOP]: {
    nextChainId: ID.ETHEREAL_CHOP,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 2,
        stacks: 1
      }
    ],
    castTimeMs: 440
  },
  [ID.ETHEREAL_CHOP]: {
    castTimeMs: 520,
    nextChainId: ID.MIRROR_STRIKES,
    effects: [
      {
        type: 'strike',
        coefficient: 0.55,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.LINGERING_THOUGHTS]: {
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Whirl',
        applications: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castEnd',
      atMs: 160
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 1,
        stacks: 3
      }
    ],
    castTimeMs: 920
  },
  // Virtuoso and Troubadour Axe variants retain separate IDs so their conditions and finishers resolve independently.
  [ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS]: {
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Whirl',
        applications: 2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 1,
        stacks: 3
      }
    ],
    // The shared replacement keeps the same measured Axe cast timing as Mirage.
    castTimeMs: 920
  },
  [ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY]: {
    // The shared weapon variant retains the same shadowstep and relic response timing.
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'axe'
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 5
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 6,
        stacks: 1
      }
    ],
    castTimeMs: 1000
  }
});
