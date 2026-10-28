/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

// Snap each intended packet independently so rounding a repeated interval cannot accumulate drift.
export const REVENANT_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RAPID_SWIPE]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rapid Swipe',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FORCEFUL_BASH]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Forceful Bash',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.REJUVENATING_ASSAULT]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 680,
    comboFinishers: [{ ownerId: 'revenant', finisherType: COMBO_FINISHER.WHIRL }],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(340 + index * 340),
          coefficient: 2 / 2
        })),
        name: 'Rejuvenating Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.MENDERS_REBUKE]: {
    cooldown: 5,
    energyCost: 5,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: "Mender's Rebuke",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.WARDING_RIFT]: {
    cooldown: 12,
    energyCost: 10,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Warding Rift',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.RENEWING_WAVE]: {
    cooldown: 15,
    energyCost: 15,
    castTimeMs: 680,
    effects: []
  },
  [ID.SURGE_OF_THE_MISTS]: {
    cooldown: 20,
    energyCost: 15,
    // Reviewed timings are Quickness durations; Surge's coefficient is the total across nine hits.
    castTimeMs: 1720,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(75.48 + index * 75.48), // TODO: Validate these estimated packet offsets against a combat log.
          coefficient: 3.24 / 9
        })),
        name: 'Surge of the Mists',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  }
});
