/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RIFLE_BUTT]: {
    implemented: true,
    // Rifle Butt uses its successful-hit recharge and reloads the rest of the rifle kit on completion.
    cooldown: 12,
    mechanicTriggers: [
      {
        type: 'warrior.core.reload-rifle',
        timingAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'knockback'
        }
      }
    ]
  },
  [ID.VOLLEY]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 1667,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 5
      }
    ]
  },
  [ID.FIERCE_SHOT]: {
    implemented: true,
    // Rifle projectile finishers stay declarative so each emitted shot uses the shared combo scheduler.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.EXPLOSIVE_SHELL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      }
    ]
  },
  [ID.BRUTAL_SHOT]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 12
      }
    ]
  }
});
