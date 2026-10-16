import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isActivePetStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { deliverChargedHit } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Spider family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_SPIDER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Poison Gas uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_POISON_GAS]: {
    // Once the cast releases its cloud, later pulses retain the originating companion.
    interruptCommitMs: 3000,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        applications: 3,
        intervalMs: 1000,
        persistsAfterInterrupt: true,
        comboFields: [
          {
            ownerId: 'ranger',
            ownerActorType: 'summon',
            fieldType: 'Poison',
            duration: 4
          }
        ],
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_POISON_GAS]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Entangling Web uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPIDER_ENTANGLING_WEB]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: 'summon',
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIDER_ENTANGLING_WEB]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.DEADLY_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PARALYZING_VENOM]: {
    // The venom arms the pet's next landed attack for twenty seconds (wiki: Paralyzing_Venom).
    effects: [
      {
        type: 'buff',
        kind: 'paralyzing-venom',
        duration: 20,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        audience: { recipients: 'self' }
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.WEAKENING_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SPIT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.57,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPIT]!.quicknessCastTimeMs,
    petSkill: true
  }
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

  deliverChargedHit(context, event, PROFILE.paralyzingVenom, () => consumeCharge(pet.paralyzingVenom, event.at), {
    attribution: {
      source: 'ranger-pet',
      sourceId: ID.PARALYZING_VENOM,
      actorType: 'summon',
      skillId: ID.PARALYZING_VENOM,
      skillName: 'Paralyzing Venom',
      activationId: event.activationId
    },
    fields: rangerPetCombatMetadata(context)
  });
}
