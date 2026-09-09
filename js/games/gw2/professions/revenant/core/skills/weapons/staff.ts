/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Snap each intended packet independently so rounding a repeated interval cannot accumulate drift.
export const REVENANT_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SURGE_OF_THE_MISTS]: {
    // Reviewed timings are Quickness durations; Surge's coefficient is the total across nine hits.
    quicknessCastTimeMs: 1720,
    cooldown: 20,
    energyCost: 15,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(75.48 + index * 75.48), // TODO: Need to get proper timing
          coefficient: 3.24 / 9
        })),
        name: 'Surge of the Mists',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 120
      }
    ]
  },
  [ID.REJUVENATING_ASSAULT]: {
    quicknessCastTimeMs: 680,
    comboFinishers: [{ ownerId: 'revenant', finisherType: 'Whirl', ambiguousFieldSelection: 'oldest' }],
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(340 + index * 340),
          coefficient: 2 / 2
        })),
        name: 'Rejuvenating Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.MENDERS_REBUKE]: {
    castTimeMs: 750,
    cooldown: 5,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: "Mender's Rebuke",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.RAPID_SWIPE]: {
    quicknessCastTimeMs: 440,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rapid Swipe',
        actorType: 'player'
      }
    ]
  },
  [ID.WARDING_RIFT]: {
    castTimeMs: 1500,
    cooldown: 12,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Warding Rift',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.RENEWING_WAVE]: {
    castTimeMs: 1000,
    cooldown: 15,
    energyCost: 15,
    effects: []
  },
  [ID.FORCEFUL_BASH]: {
    quicknessCastTimeMs: 440,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Forceful Bash',
        actorType: 'player'
      }
    ]
  }
});
