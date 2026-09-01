/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer mace skill damage, conditions, boons, control, and combo behavior. */
export const ENGINEER_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MACE_SMASH]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mace Smash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 2,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ENERGIZING_SLAM]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 1.85,
        hits: 1,
        name: 'Energizing Slam',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.MACE_BLAST]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 0,
    // Mace Blast is both an Explosion for Engineer traits and a leap combo finisher.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Mace Blast',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.MACE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mace Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_FIST_PROTOTYPE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Rocket Fist Prototype',
        actorType: 'player',
        // The fist explodes on impact while the traveling fist is a physical projectile finisher.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 1
      }
    ]
  }
});
