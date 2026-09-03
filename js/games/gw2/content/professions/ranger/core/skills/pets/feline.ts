/**
 * Owns Core Ranger pet skill fragments for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_FELINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FURIOUS_POUNCE]: {
    effects: [
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
    ],
    quicknessCastTimeMs: 1000,
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
    quicknessCastTimeMs: 480,
    petSkill: true
  },
  [ID.FELINE_BITE]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Vulnerability', stacks: 5, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 800,
    petSkill: true
  },
  [ID.FELINE_MAUL]: {
    effects: [
      {
        type: 'strike',
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 4, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 840,
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
