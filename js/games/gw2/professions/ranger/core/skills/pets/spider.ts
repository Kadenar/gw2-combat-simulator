/**
 * Owns Core Ranger pet skill definitions for the Spider family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { isActivePetStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { deliverChargedHit } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

export const RANGER_CORE_SPIDER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Poison Gas uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_POISON_GAS]: definePetSkill({
    name: 'Poison Gas',
    description: 'Spit a ball of venom that covers an area with a poisonous cloud. ',
    icon: new URL('@images/wiki/poison-gas.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Forest Spider', 'Jungle Spider', 'Cave Spider', 'Black Widow Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.quicknessCastTimeMs,
    // Once the cast releases its cloud, later pulses retain the originating companion.
    interruptCommitMs: 3000,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 6,
        applications: 3,
        intervalMs: 1000,
        persistsAfterInterrupt: true,
        comboFields: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            fieldType: COMBO_FIELD.POISON,
            duration: 4
          }
        ],
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Entangling Web uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_ENTANGLING_WEB]: definePetSkill({
    name: 'Entangling Web',
    description: 'Shoot a web, immobilizing your foe.',
    icon: new URL('@images/wiki/entangling-web.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Forest Spider', 'Jungle Spider', 'Cave Spider', 'Black Widow Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.DEADLY_VENOM]: definePetSkill({
    name: 'Deadly Venom',
    description: 'Beast. Your next three attacks poison your foe.',
    icon: 'https://render.guildwars2.com/file/D8AAF1C759E0E4F0A4C85A9462DF75055EB5BF92/104052.png',
    petNames: ['Forest Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 2,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.PARALYZING_VENOM]: definePetSkill({
    name: 'Paralyzing Venom',
    description: 'Beast. Your next attack immoblizes your foe.',
    icon: 'https://render.guildwars2.com/file/D8AAF1C759E0E4F0A4C85A9462DF75055EB5BF92/104052.png',
    petNames: ['Jungle Spider', 'Black Widow Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 333,
    // The venom arms the pet's next landed attack for twenty seconds (wiki: Paralyzing_Venom).
    effects: [
      {
        type: 'buff',
        kind: 'paralyzing-venom',
        // This applied buff owns both arming and the later pet-attributed condition.
        reactions: [
          {
            on: 'buff.applied',
            actor: ACTOR.SUMMON,
            packets: 'first',
            do: {
              type: 'ranger.paralyzing-venom',
              id: 'paralyzing-venom',
              effects: [
                {
                  name: CONDITION.IMMOBILIZED,
                  type: 'condition',
                  condition: CONDITION.IMMOBILIZED,
                  stacks: 1,
                  duration: 3
                }
              ]
            }
          }
        ],
        duration: 20,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        audience: { recipients: RECIPIENT.SELF }
      }
    ]
  }),
  [ID.WEAKENING_VENOM]: definePetSkill({
    name: 'Weakening Venom',
    description: 'Beast. Your next two attacks weaken your foes and make them vulnerable.',
    icon: 'https://render.guildwars2.com/file/D8AAF1C759E0E4F0A4C85A9462DF75055EB5BF92/104052.png',
    petNames: ['Cave Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.SPIT]: definePetSkill({
    name: 'Spit',
    description: 'Spit at your foe.',
    icon: 'https://render.guildwars2.com/file/B7A1AB65571565525A5C35DBCBEF0326DF65C3FA/104050.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Forest Spider', 'Jungle Spider', 'Cave Spider', 'Black Widow Spider'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIT]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.57,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
});

/** Only the active caster can arm its follow-up; retired pets cannot grant it to their replacement. */
export function armParalyzingVenom(runtime: RangerRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'paralyzing-venom' || event.sourceId !== ID.PARALYZING_VENOM) return;

  const pet = rangerOwningPetState(runtime.profession.core.pet, event.summonOwner);

  // The venom arms one strike until its buff expires.
  if (pet) pet.paralyzingVenom = grantCharges(1, runtime.time + Number(event.duration));
}

/** The first accepted strike by the armed companion consumes its venom, retaining pet condition ownership. */
export function consumeParalyzingVenom(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const { pet } = context.profession.core;

  if (!pet || !isActivePetStrike(context, event)) return;

  if (pet.paralyzingVenom.charges <= 0) return;

  deliverChargedHit(
    context,
    event,
    ID.PARALYZING_VENOM,
    'paralyzing-venom',
    () => consumeCharge(pet.paralyzingVenom, event.at),
    {
      attribution: {
        source: 'ranger-pet',
        sourceId: ID.PARALYZING_VENOM,
        actorType: ACTOR.SUMMON,
        skillId: ID.PARALYZING_VENOM,
        skillName: 'Paralyzing Venom',
        activationId: event.activationId
      },
      fields: rangerPetCombatMetadata(context)
    }
  );
}
