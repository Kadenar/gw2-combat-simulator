/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// The opening strike is followed by five field pulses.
const CHAOS_STORM_PULSES_MS = [280, 1280, 2280, 3280, 4280, 5280];

export const MESMER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CHAOS_STORM]: {
    // Once the field's opening impact lands, cancelling the aftercast preserves its remaining pulses.
    interruptCommitMs: CHAOS_STORM_PULSES_MS[0],
    mechanicTriggers: [
      { type: 'mesmer.core.chaos-storm-poison', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ],
    mesmerMechanic: {
      // Each selected pulse applies one complete stack; the mechanic alternates two and three selections per cast.
      chaosStormPoison: {
        type: 'condition',
        ticks: CHAOS_STORM_PULSES_MS.slice(1).map((atMs) => ({ atMs, condition: 'Poisoned', duration: 4, stacks: 1 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    },
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: 'Ethereal',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: CHAOS_STORM_PULSES_MS.map((atMs) => ({ atMs, coefficient: 0.33 })),
        name: 'Six pulses',
        actorType: 'player'
      },
      {
        // Only the first impact dazes; subsequent field pulses do not repeat the CC.
        type: 'control',
        controlKind: 'daze',
        source: 'Player',
        actorType: 'player',
        atMs: CHAOS_STORM_PULSES_MS[0]
      }
    ]),
    castTimeMs: 480
  },
  [ID.PHANTASMAL_WARLOCK]: {
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 2
    },
    // Committed interrupts retain the full cast lockout and the phantasm launched at the fixed summon point.
    retainsCastLockoutAfterInterrupt: true,
    interruptCommitMs: 600,
    phantasmSummonProgress: 600 / 880,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 1200, coefficient: 0.15 },
          { atMs: 2000, coefficient: 0.15 },
          { atMs: 2800, coefficient: 0.15 }
        ],
        name: 'One warlock',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'Phantasm high',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Torment',
        duration: 4,
        stacks: 6,
        actorType: 'summon',
        summonKind: 'phantasm',
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 880
  },
  [ID.WINDS_OF_CHAOS]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 0.3 },
          { atMs: 640, coefficient: 0.3 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'staff',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'torment',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 760
  },
  [ID.PHASE_RETREAT]: {
    shadowstepSkill: true,
    peithaImpactDelayMs: 840,
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    resource: {
      mode: 'add',
      count: 1
    },
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: []
  },
  [ID.CHAOS_ARMOR]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    effects: [
      // The activation blinds once for five seconds, independently of its Confusion.
      { type: 'blind', duration: 5, source: 'Player', actorType: 'player' },
      {
        type: 'condition',
        condition: 'confusion',
        duration: 5,
        stacks: 3
      }
    ]
  }
});
