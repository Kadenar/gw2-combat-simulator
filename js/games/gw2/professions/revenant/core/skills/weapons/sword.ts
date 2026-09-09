/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Snap each intended packet independently so rounding a repeated interval cannot accumulate drift.
export const REVENANT_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.UNRELENTING_ASSAULT]: {
    // Represent both activation phases with their reviewed total Quickness duration.
    quicknessCastTimeMs: 840,
    cooldown: 12,
    energyCost: 15,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          // Preserve the supplied first impact and equal spacing through the final cast frame.
          atMs: 260 + index * ((840 - 260) / 4),
          coefficient: 3.9325 / 5
        })),
        name: 'Unrelenting Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.DEATHSTRIKE]: {
    quicknessCastTimeMs: 720,
    cooldown: 15,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: 420,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.45 }],
        name: 'Deathstrike',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.67 }],
        name: 'Deathstrike — Follow-up',
        // Track the follow-up separately while retaining Deathstrike as the casting skill.
        damageBreakdownName: 'Deathstrike — Follow-up',
        sourceId: ID.DEATHSTRIKE_ID_28625,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHACKLING_WAVE]: {
    quicknessCastTimeMs: 800,
    // The follow-up wave keeps landing after a 720 ms aftercast cancellation.
    interruptCommitMs: 720,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1.2 }],
        name: 'Initial Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        name: 'Additional Strikes',
        actorType: 'player',
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 720, coefficient: 0.4 },
          { atMs: 800, coefficient: 0.4 },
          { atMs: 880, coefficient: 0.4 },
          { atMs: 960, coefficient: 0.4 },
          { atMs: 1040, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Immobilized', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Vulnerability', stacks: 8, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DEATHSTRIKE_ID_28625]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.67,
        hits: 1,
        name: 'Deathstrike — Follow-up',
        damageBreakdownName: 'Deathstrike — Follow-up',
        actorType: 'player'
      }
    ]
  },
  [ID.RIFT_SLASH]: {
    quicknessCastTimeMs: 480,
    interruptCommitMs: 440,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.9 }],
        name: 'Rift Slash',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1400, coefficient: 0.2175 }],
        name: 'Rift Slash — Rift',
        // The delayed rift has its own logged damage identity, separate from the sword attack.
        damageBreakdownName: 'Rift Slash — Rift',
        sourceId: 29073,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      }
    ]
  },
  [ID.PREPARATION_THRUST]: {
    quicknessCastTimeMs: 360,
    // A shortened opening thrust can land and advance the chain before its full animation ends.
    interruptCommitMs: 320,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.75 }],
        name: 'Preparation Thrust',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CHILLING_ISOLATION]: {
    castTimeMs: 680,
    unaffectedByQuickness: true,
    interruptCommitMs: 360,
    cooldown: 5,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        name: 'Chilling Isolation — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.6 }],
        name: 'Isolated Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BRUTAL_BLADE]: {
    quicknessCastTimeMs: 560,
    // The measured 518 ms cancellation retains the strike on the 520 ms action frame.
    interruptCommitMs: 520,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.8 }],
        name: 'Brutal Blade',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Vulnerability', stacks: 2, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
