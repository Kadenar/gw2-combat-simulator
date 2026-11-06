/**
 * Owns Core Engineer skills created by trait procs and trait-triggered actions.
 * Trait triggers own selection and invocation; these skills own their payload and delivery.
 */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines the catalog definitions used by Core Engineer trait effects. */
export const ENGINEER_TRAIT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<EngineerSkill>>> = {
  [ID.LESSER_GRENADE_BARRAGE]: {
    name: 'Lesser Grenade Barrage',
    icon: 'https://render.guildwars2.com/file/5B2AB667667749BC1BC7AEFD27362E3E0E0F2FE6/103294.png',
    type: 'Proc',
    slot: 'Action',
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
    name: 'Lesser Elixir B',
    icon: 'https://render.guildwars2.com/file/19E19A741B72550BF44E96F43C28571CCB059FBC/103402.png',
    type: 'Proc',
    slot: 'Action',
    skillFamily: 'Elixir',
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
    name: 'Static Discharge',
    icon: 'https://render.guildwars2.com/file/01D310FE65DBA378CBAFD13B2BFEDE59939C5153/102964.png',
    type: 'Proc',
    slot: 'Action',
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    criticalDamage: 2,
    // Double this skill's critical factor; native registration scopes the rule to its owner.
    modifiers: [
      {
        id: 'engineer.static-discharge-critical-damage',
        order: -9,
        target: MODIFIER_TARGET.CRITICAL_DAMAGE,
        operation: 'multiply',
        factor: (context) =>
          skillNumber(requireSkill(context.catalog, ID.STATIC_DISCHARGE_TRAIT_SKILL), 'criticalDamage')
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
    name: 'Drop Mine',
    icon: 'https://render.guildwars2.com/file/C2A603094B5709BE213D391AFD4D33293C19EA38/103396.png',
    type: 'Proc',
    slot: 'Action',
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
    name: 'Magnetic Aura (trait skill)',
    icon: 'https://render.guildwars2.com/file/206FCC2A05035FDB306AB5136E5F3AC0FC6467F3/103395.png',
    type: 'Proc',
    slot: 'Action',
    patchAuthoringExcluded: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.BUNKER_DOWN_TRAIT_SKILL]: {
    name: 'Bunker Down (trait skill)',
    icon: 'https://render.guildwars2.com/file/6BDE0704072F580D5818C004FB6CFA42A4F10F57/104786.png',
    type: 'Proc',
    slot: 'Action',
    patchAuthoringExcluded: true,
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
    name: 'Cleansing Pulse',
    icon: 'https://render.guildwars2.com/file/1B0C0900BD7F04324E1695BCF97D5AF8AD0609B7/103419.png',
    type: 'Proc',
    slot: 'Action',
    patchAuthoringExcluded: true,
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
    name: 'Lesser Utility Goggles',
    icon: 'https://render.guildwars2.com/file/4ED8F42447B076AF1DD410430974C7BE7A0F7F61/103417.png',
    type: 'Proc',
    slot: 'Action',
    skillFamily: 'Gadget',
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
    name: 'Aim-Assisted Rocket',
    icon: 'https://render.guildwars2.com/file/C61F211044C97242B6324B6F092802706A5FC101/103936.png',
    type: 'Proc',
    slot: 'Action',
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
    name: 'Bandage (trait skill)',
    icon: 'https://render.guildwars2.com/file/50C2CA45076553093FCF2135FBD7439280EE67F1/240697.png',
    type: 'Proc',
    slot: 'Action',
    patchAuthoringExcluded: true,
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
    name: 'Orbital Command Strike',
    icon: 'https://render.guildwars2.com/file/99CFD7B1B200DCC508172BC8A3C2EE970C06493E/1012854.png',
    type: 'Proc',
    slot: 'Action',
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
    name: 'Controlled Analysis',
    icon: 'https://render.guildwars2.com/file/5DF2A130174A73B268A1683DCF5ED39AD0325592/103460.png',
    type: 'Proc',
    slot: 'Action',

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
    name: 'Explosive Entrance',
    icon: 'https://render.guildwars2.com/file/02A02091B1EBDB782719EB6AE56F01E6372C500D/103091.png',
    type: 'Proc',
    slot: 'Action',
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
};
