/**
 * Owns Core Ranger pet skill fragments for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FELINE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MIGHTY_ROAR]: {
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 15,
        stacks: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.RENDING_POUNCE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ICY_POUNCE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 2,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ICY_BITE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
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
    quicknessCastTimeMs: 167,
    petSkill: true
  },
  [ID.STALK]: {
    // Jaguar grants its ranger stealth, enabling spear attacks without spending Panther's Prowl.
    effects: [{ type: 'buff', kind: 'stealth', duration: 3, stacks: 1 }],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FURIOUS_POUNCE]: {
    // Impact precedes the remaining animation; the pet lane retains the full recovery.
    effects: impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FURIOUS_POUNCE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FELINE_SLASH]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_SLASH]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FELINE_BITE]: {
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
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
      }
    ]),
    // Recorded pet activation timing keeps manual commands on the pet's independent lane.
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_BITE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FELINE_MAUL]: {
    // Each strike applies its own two stacks, so the second hit cannot bleed early.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [360, 560].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 2, duration: 10 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FELINE_MAUL]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.SAVANNAH_STRIKE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  },
  [ID.BLINDING_ROAR]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.0499999999999998,
        hits: 3,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.GUARDIANS_ROAR]: {
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});
