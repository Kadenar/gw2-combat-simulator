import { ACTOR, RECIPIENT, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
/**
 * Owns Core Engineer skills created by trait procs and trait-triggered actions.
 * Trait triggers own selection and invocation; these skills own their payload and delivery.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';

/** Defines the catalog fragments used by Core Engineer trait effects. */
export const ENGINEER_TRAIT_SKILL_MECHANICS: Readonly<Record<number, Partial<EngineerSkill>>> = Object.freeze({
  [ID.LESSER_GRENADE_BARRAGE]: {
    cooldown: 20,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        // Approximate scatter as three landed half-coefficient grenades at the average impact delay.
        coefficient: 1.5,
        hits: 3,
        atMs: 730,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Lesser Grenade Barrage',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        weapon: 'Unequipped',
        damageKind: 'explosion'
      }
    ]
  },
  [ID.LESSER_ELIXIR_B]: {
    cooldown: 24,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.STATIC_DISCHARGE_TRAIT_SKILL]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    criticalDamage: 2,
    // Double this skill's critical factor; native registration scopes the rule to its owner.
    modifiers: [
      {
        id: 'engineer.static-discharge-critical-damage',
        order: -9,
        target: MODIFIER_TARGET.CRITICAL_DAMAGE,
        operation: 'multiply',
        factor: (context) => skillNumberFromContext(context, ID.STATIC_DISCHARGE_TRAIT_SKILL, 'criticalDamage')
      }
    ],
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Static Discharge',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped'
      }
    ]
  },
  [ID.DROP_MINE]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        name: 'Drop Mine',
        actorType: ACTOR.PLAYER
      }
    ]
  },

  [ID.MAGNETIC_AURA_TRAIT_SKILL]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    cooldown: 1,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.95,
        hits: 1,
        name: 'Bunker Down (trait skill)',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 6,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  },

  [ID.CLEANSING_PULSE]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.LESSER_UTILITY_GOGGLES]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aim-Assisted Rocket',
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        damageKind: 'explosion'
      }
    ]
  },
  [ID.BANDAGE_TRAIT_SKILL]: {
    cooldown: 1,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.ORBITAL_COMMAND_STRIKE]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Orbital Command Strike',
        atMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        comboFinishers: [{ ownerId: 'engineer', finisherType: COMBO_FINISHER.BLAST, chance: 1 }]
      }
    ]
  },
  [ID.CONTROLLED_ANALYSIS]: {
    cooldown: 25,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]: {
    cooldown: 0.25,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Explosive Entrance',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        weapon: 'Unequipped',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        damageKind: 'explosion'
      }
    ]
  }
});
