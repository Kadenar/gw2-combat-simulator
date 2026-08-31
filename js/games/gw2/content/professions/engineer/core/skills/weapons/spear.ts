/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer spear fragments and binds stateful spear skills to their execution handlers. */
export const ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PUNCTURING_JAB]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Puncturing Jab',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.DEVASTATOR]: {
    implemented: true,
    handlerId: 'engineer.devastator',
    castTimeMs: 1000,
    unaffectedByQuickness: true,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Devastator',
        actorType: 'player',
        // Only the primary impact is the blast; focused follow-up packets must not create extra combos.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.ROILING_SKIES]: {
    implemented: true,
    handlerId: 'engineer.roiling-skies',
    castTimeMs: 1000,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Roiling Skies',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.AMPLIFYING_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.99,
        hits: 1,
        name: 'Amplifying Slice',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.LIGHTNING_ROD]: {
    implemented: true,
    handlerId: 'engineer.lightning-rod',
    castTimeMs: 400,
    unaffectedByQuickness: true,
    cooldown: 12,
    effects: []
  },
  [ID.FOCUSED_DEVASTATION]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 6,
        atMs: 0,
        name: 'Focused Devastation',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 6,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.RENDING_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rending Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.CONDUIT_SURGE]: {
    implemented: true,
    handlerId: 'engineer.conduit-surge',
    castTimeMs: 520,
    unaffectedByQuickness: true,
    cooldown: 5,
    // The dash completes one leap combo at impact, where the replacement handler also applies Focused.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: []
  },
  [ID.ELECTRIC_ARTILLERY]: {
    implemented: true,
    handlerId: 'engineer.electric-artillery',
    quicknessCastTimeMs: 520,
    cooldown: 1,
    effects: []
  }
});
