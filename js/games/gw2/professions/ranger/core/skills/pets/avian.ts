/**
 * Owns Core Ranger pet skill fragments for the Avian family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_AVIAN_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BIRD_SLASH]: {
    // EVTC separates the claw contacts by about 80 ms, despite the wiki describing simultaneous hits.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 320].map((atMs) => ({ atMs, coefficient: 0.38 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SLASH]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.BIRD_SWOOP]: {
    // The live pet applies one Vulnerability despite the tooltip advertising five.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.66,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }]
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SWOOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SWOOP]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.QUICKENING_SCREECH_PET]: {
    // The pet supplies this party boon, so its duration uses pet concentration rather than the ranger's gear.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.QUICKENING_SCREECH_PET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.QUICKENING_SCREECH_PET]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.BLINDING_SLASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.CHILLING_SLASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.BRASH_SLASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
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
  [ID.LACERATING_SLASH]: {
    // Each of the two hits applies three bleeding stacks, six in total.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 320].map((atMs) => ({ atMs, coefficient: 1 })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [280, 320].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 3, duration: 15 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.LACERATING_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.LACERATING_SLASH]!.quicknessCastTimeMs,
    petSkill: true
  }
});
