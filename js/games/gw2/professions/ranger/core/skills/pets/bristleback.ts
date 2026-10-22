import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { ACTOR, RECIPIENT, CONDITION } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isActivePetStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { deliverChargedHit } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Bristleback family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_BRISTLEBACK_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Spike Shoot uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_SPIKE_SHOOT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.31,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SPIKE_SHOOT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SPIKE_SHOOT]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Sharpen Spines uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_SHARPEN_SPINES]: {
    effects: [
      {
        type: 'buff',
        kind: 'pet-sharpen-spines',
        duration: 30,
        stacks: 5,
        audience: {
          recipients: RECIPIENT.SELF
        },
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SHARPEN_SPINES]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_SHARPEN_SPINES]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Rain of Spikes uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.BRISTLEBACK_RAIN_OF_SPIKES]: {
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
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_RAIN_OF_SPIKES]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BRISTLEBACK_RAIN_OF_SPIKES]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.SPIKE_BARRAGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 10,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 1333,
    petSkill: true
  }
});

/** Only the active Bristleback can arm its follow-up; retired pets cannot grant it to their replacement. */
export function armPetSharpenSpines(runtime: RangerRuntime, event: Gw2ResolverEvent): void {
  const state = runtime.profession.core;

  if (
    event.kind !== 'pet-sharpen-spines' ||
    event.sourceId !== ID.BRISTLEBACK_SHARPEN_SPINES ||
    rangerPetForState(state).name !== 'Bristleback'
  )
    return;

  const pet = rangerOwningPetState(state.pet, event.summonOwner);

  if (pet) pet.sharpenSpines = grantCharges(Number(event.stacks), runtime.time + Number(event.duration));
}

/** Only the currently armed Bristleback's landed strikes can spend its expiring bleed charges. */
export function consumePetSharpenSpines(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const { pet } = context.profession.core;

  if (!pet || rangerPetForState(context.profession.core).name !== 'Bristleback' || !isActivePetStrike(context, event))
    return;

  deliverChargedHit(context, event, PROFILE.petSharpenSpines, () => consumeCharge(pet.sharpenSpines, event.at), {
    attribution: {
      source: 'ranger-pet',
      sourceId: ID.BRISTLEBACK_SHARPEN_SPINES,
      actorType: ACTOR.SUMMON,
      skillId: ID.BRISTLEBACK_SHARPEN_SPINES,
      skillName: 'Sharpen Spines',
      activationId: event.activationId
    },
    fields: rangerPetCombatMetadata(context)
  });
}
