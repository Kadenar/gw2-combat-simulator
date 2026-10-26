import { ACTOR, RECIPIENT, COMBO_FINISHER, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines Engineer mace skill damage, conditions, boons, control, and combo behavior. */
export const ENGINEER_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MACE_STRIKE]: {
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mace Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MACE_SMASH]: {
    cooldown: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mace Smash',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 2,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MACE_BLAST]: {
    cooldown: 0,
    castTimeMs: 520,
    // Mace Blast is both an Explosion for Engineer traits and a leap combo finisher.
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Mace Blast',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ENERGIZING_SLAM]: {
    cooldown: 6,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.85,
        hits: 1,
        name: 'Energizing Slam',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ROCKET_FIST_PROTOTYPE]: {
    cooldown: 12,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Rocket Fist Prototype',
        actorType: ACTOR.PLAYER,
        // The fist explodes on impact while the traveling fist is a physical projectile finisher.
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ],
        damageKind: 'explosion',
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ]
  }
});
