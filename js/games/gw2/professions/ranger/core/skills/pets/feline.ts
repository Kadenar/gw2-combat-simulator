/**
 * Owns Core Ranger pet skill fragments for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONDITION, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FELINE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Phase Pounce uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.FELINE_PHASE_POUNCE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_PHASE_POUNCE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_PHASE_POUNCE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.MIGHTY_ROAR]: {
    petSkill: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.RENDING_POUNCE]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.ICY_POUNCE]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 2,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.STALK]: {
    petSkill: true,
    quicknessCastTimeMs: 333,
    // Jaguar grants its ranger stealth, enabling spear attacks without spending Panther's Prowl.
    effects: [{ type: 'buff', kind: STATUS.STEALTH, duration: 3, stacks: 1 }]
  },
  [ID.FURIOUS_POUNCE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.quicknessCastTimeMs,
    // Impact precedes the remaining animation; the pet lane retains the full recovery.
    effects: impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  },
  [ID.FELINE_SLASH]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.FELINE_BITE]: {
    petSkill: true,
    // Recorded pet activation timing keeps manual commands on the pet's independent lane.
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.quicknessCastTimeMs,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
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
      }
    ])
  },
  [ID.FELINE_MAUL]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.quicknessCastTimeMs,
    // Each strike applies its own two stacks, so the second hit cannot bleed early.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [360, 560].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 2, duration: 10 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  },
  [ID.SAVANNAH_STRIKE]: {
    petSkill: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        stacks: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.BLINDING_ROAR]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.0499999999999998,
        hits: 3,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.GUARDIANS_ROAR]: {
    petSkill: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }
});
