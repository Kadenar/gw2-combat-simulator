/**
 * Owns Untamed Unleash, ambush, and specialization skill catalog definitions only.
 * Persistent Unleash state and transitions live under `mechanics/`.
 */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_WEAPON_AMBUSH_MECHANICS } from '#gw2/professions/ranger/specializations/untamed/skills/weapon-ambushes.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { naturalFortitudeAmbushEffect } from '#gw2/professions/ranger/specializations/untamed/traits/behavior.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

// Both Unleash actions replace the same F5 tile as control passes between pet and ranger.
const UNLEASH_PALETTE_TILE = 'ranger-untamed-unleash';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const UNTAMED_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> =
  composeSkillDefinitions<RangerSkill>(UNTAMED_WEAPON_AMBUSH_MECHANICS, {
    [ID.ENVELOPING_HAZE]: {
      name: 'Enveloping Haze',
      icon: 'https://render.guildwars2.com/file/39EFE795AEE7A670EAC0CC34C8526A2EB899ED4C/2503727.png',
      type: 'Profession',
      slot: 'Profession_3',
      cooldown: 20,
      independentCast: true,
      unleashedPetSkill: true,
      castTimeMs: 0,
      comboFields: [
        {
          ownerId: 'ranger',
          fieldType: COMBO_FIELD.POISON,
          duration: 5,
          startAnchor: 'castEnd'
        }
      ],
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // Pet-side damage uses 0.25 per pulse; the command tooltip's aggregate is not this packet's coefficient.
          // ponytail: use the unleashed-pet profile; tracking the pet's current AI weapon would cover inherited Haze rolls.
          weaponStrengthProfileId: 'summon.weapon-type-1',
          ticks: [0, 1000, 2000, 3000, 4000, 5000].map((atMs) => ({
            atMs,
            coefficient: 0.25
          })),
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          ticks: [0, 1000, 2000, 3000, 4000, 5000].map((atMs) => ({
            atMs,
            condition: CONDITION.CHILLED,
            stacks: 1,
            duration: 1
          })),
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        }
      ])
    },
    [ID.NATURES_BINDING]: {
      name: "Nature's Binding",
      icon: 'https://render.guildwars2.com/file/F85F41A1F75C3F04CBAAE94EFF0D77A2219F5623/2503733.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Cantrip',
      cooldown: 25,
      castTimeMs: 500,
      effects: []
    },
    [ID.UNLEASH_RANGER]: {
      name: 'Unleash Ranger',
      icon: 'https://render.guildwars2.com/file/EFC812F33C2A9ECA91F0C1F966E1715FF35E2BDF/2503729.png',
      type: 'Profession',
      slot: 'Profession_5',
      cooldown: 1,
      // Both Unleash sides receive the same fixed, Alacrity-independent recharge.

      paletteTileId: UNLEASH_PALETTE_TILE,
      paletteTileOrder: 1,
      castTimeMs: 0,
      effects: [],
      // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
      sideEffects: [{ on: 'castCommit', do: { type: 'ranger.unleash-ranger' } }]
    },
    [ID.EXPLODING_SPORES]: {
      name: 'Exploding Spores',
      icon: 'https://render.guildwars2.com/file/DF265CBF73C17E9C96EDE6035CAE9A381E1D11F1/2503730.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Cantrip',
      cooldown: 25,
      castTimeMs: 480,
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.583 * 6,
          hits: 6,
          atMs: 1640
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 6 }, () => ({
            atMs: 1640,
            condition: CONDITION.POISONED,
            stacks: 1,
            duration: 5
          }))
        },
        // Capture unleash at acceptance while leaving each branch independently patchable/removable.
        {
          name: 'Ranger unleashed Might',
          type: 'boon',
          boon: BOON.MIGHT,
          stacks: 8,
          duration: 10,
          timingAnchor: 'castEnd',
          atMs: 0,
          when: (runtime) => untamedState.from(runtime.profession).rangerUnleashed
        },
        {
          name: 'Pet unleashed Protection',
          type: 'boon',
          boon: BOON.PROTECTION,
          stacks: 1,
          duration: 4,
          timingAnchor: 'castEnd',
          atMs: 0,
          when: (runtime) => !untamedState.from(runtime.profession).rangerUnleashed
        },
        {
          type: 'control',
          atMs: 1640,
          controlKind: CONTROL.KNOCKDOWN
        }
      ])
    },
    [ID.FORESTS_FORTIFICATION]: {
      name: "Forest's Fortification",
      icon: 'https://render.guildwars2.com/file/387423FEEF4639CFF0A4532C06CBCB5701933331/2503712.png',
      type: 'Elite',
      slot: 'Elite',
      skillFamily: 'Cantrip',
      cooldown: 90,
      // Use the effective cast duration so defensive boons begin at the corrected completion time.
      castTimeMs: 840,
      effects: [
        {
          type: 'boon',
          boon: BOON.STABILITY,
          duration: 6,
          stacks: 10
        },
        {
          type: 'boon',
          boon: BOON.RESISTANCE,
          duration: 6,
          stacks: 1
        },
        {
          type: 'boon',
          boon: BOON.RESOLUTION,
          duration: 6,
          stacks: 1
        }
      ]
    },
    [ID.VENOMOUS_OUTBURST]: {
      name: 'Venomous Outburst',
      icon: 'https://render.guildwars2.com/file/DE977DE6D693A71B24AFCC01E6EBF8F30DD4669E/2503725.png',
      type: 'Profession',
      slot: 'Profession_1',
      cooldown: 13,
      independentCast: true,
      unleashedPetSkill: true,
      castTimeMs: 0,
      // Impact about 280 ms after activation, allowing intervening buffs to apply.
      effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // Unleashed attacks use the pet's type-1 weapon, not the generic autonomous-attack strength.
          weaponStrengthProfileId: 'summon.weapon-type-1',
          coefficient: 1,
          hits: 1,
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 3,
          duration: 8,
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        },
        {
          // Capture defiant-target eligibility at acceptance while retaining pet ownership.
          type: 'condition',
          when: (runtime) => Boolean(runtime.config.target?.defiant),
          condition: CONDITION.VULNERABILITY,
          stacks: 8,
          duration: 10,
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        }
      ])
    },
    [ID.RENDING_VINES]: {
      name: 'Rending Vines',
      icon: 'https://render.guildwars2.com/file/68D3A9D218CE4F19F0D1E1A2F20F953D103FE99A/2503726.png',
      type: 'Profession',
      slot: 'Profession_2',
      cooldown: 13,
      independentCast: true,
      unleashedPetSkill: true,
      castTimeMs: 0,
      effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          weaponStrengthProfileId: 'summon.weapon-type-1',
          coefficient: 1.3,
          hits: 1,
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON,
          comboFinishers: [
            {
              ownerId: 'ranger',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.SLOW,
          stacks: 1,
          duration: 4,
          source: 'ranger-pet',
          actorType: ACTOR.SUMMON
        }
      ])
    },
    [ID.PERILOUS_GIFT]: {
      name: 'Perilous Gift',
      icon: 'https://render.guildwars2.com/file/CF914B52D8B0B47D19245203726BF6C7366F33B5/2503724.png',
      type: 'Heal',
      slot: 'Heal',
      skillFamily: 'Cantrip',
      cooldown: 30,
      castTimeMs: 500,
      effects: []
    },
    [ID.UNLEASH_PET]: {
      name: 'Unleash Pet',
      icon: 'https://render.guildwars2.com/file/A5E324616977BF624698CA610628B7C3D73ADB1C/2503728.png',
      type: 'Profession',
      slot: 'Profession_5',
      cooldown: 1,
      // Both Unleash sides receive the same fixed, Alacrity-independent recharge.

      paletteTileId: UNLEASH_PALETTE_TILE,
      paletteTileOrder: 2,
      castTimeMs: 0,
      effects: [],
      // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
      sideEffects: [{ on: 'castCommit', do: { type: 'ranger.unleash-pet' } }]
    },
    [ID.RELENTLESS_WHIRL]: {
      name: 'Relentless Whirl',
      icon: 'https://render.guildwars2.com/file/1FD6BA0D5205082CF724026543A9CE3EA9E3AB10/2565748.png',
      type: 'Weapon',
      weapon: 'Hammer',
      slot: 'Weapon_1',
      unleashedAmbushSkill: true,
      cooldown: 0,
      castTimeMs: 1560,
      interruptMode: 'per-packet',
      effects: [
        {
          type: 'strike',
          ticks: [360, 640, 920, 1200, 1480].map((atMs) => ({
            atMs,
            coefficient: 1
          })),
          timingAnchor: 'castStart',
          timingScale: 'cast'
        },
        {
          type: 'boon',
          boon: BOON.STABILITY,
          duration: 3,
          stacks: 2,
          atMs: 360,
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        ...impactEffects({ atMs: 1720, timingAnchor: 'castStart', timingScale: 'fixed' }, [
          {
            type: 'strike',
            sourceId: ID.EXPLODING_SPORE,
            independentSourceStrike: true,
            name: 'Exploding Spore',
            // Keep spore damage in its own breakdown row while retaining the ambush's cast attribution.
            damageBreakdownName: 'Exploding Spore',
            coefficient: 0.583,
            skillName: 'Exploding Spore',
            // Hammer's delayed spore uses the non-weapon damage range observed in both Untamed EVTCs.
            weaponStrengthProfileId: 'nonweapon.unequipped',
            parentSkillName: 'Relentless Whirl'
          },
          {
            type: 'condition',
            sourceId: ID.EXPLODING_SPORE,
            name: 'Exploding Spore - Poisoned',
            damageBreakdownName: 'Exploding Spore',
            condition: CONDITION.POISONED,
            stacks: 2,
            duration: 5,
            skillName: 'Exploding Spore',
            parentSkillName: 'Relentless Whirl'
          }
        ]),
        naturalFortitudeAmbushEffect(360)
      ],
      // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
      sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }]
    },
    [ID.DEFT_STRIKE]: {
      name: 'Deft Strike',
      icon: 'https://render.guildwars2.com/file/583FF23D285DAFF432CF2C3BFBE27FF4142D4C9B/2565753.png',
      type: 'Weapon',
      weapon: 'Sword',
      slot: 'Weapon_1',
      unleashedAmbushSkill: true,
      cooldown: 0,
      castTimeMs: 960,
      effects: [
        ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
          {
            type: 'strike',
            coefficient: 3
          },
          {
            type: 'control',
            controlKind: CONTROL.DAZE
          }
        ]),
        ...impactEffects({ atMs: 2160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
          {
            type: 'strike',
            sourceId: ID.EXPLODING_SPORE,
            independentSourceStrike: true,
            name: 'Exploding Spore',
            damageBreakdownName: 'Exploding Spore',
            coefficient: 0.583,
            skillName: 'Exploding Spore',
            parentSkillName: 'Deft Strike'
          },
          {
            type: 'condition',
            sourceId: ID.EXPLODING_SPORE,
            name: 'Exploding Spore - Poisoned',
            damageBreakdownName: 'Exploding Spore',
            condition: CONDITION.POISONED,
            stacks: 2,
            duration: 5,
            skillName: 'Exploding Spore',
            parentSkillName: 'Deft Strike'
          }
        ]),
        naturalFortitudeAmbushEffect(800)
      ],
      // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
      sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }]
    }
  });
