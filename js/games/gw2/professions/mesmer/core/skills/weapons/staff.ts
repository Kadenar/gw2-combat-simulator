/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, AURA, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// The opening strike is followed by five field pulses.
const CHAOS_STORM_PULSES_MS = [280, 1280, 2280, 3280, 4280, 5280];

export const MESMER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.WINDS_OF_CHAOS]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 760,
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 0.3 },
          { atMs: 640, coefficient: 0.3 }
        ],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.STAFF.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.PHASE_RETREAT]: {
    shadowstepSkill: true,
    peithaImpactDelayMs: 840,
    rechargeAnchor: 'castStart',
    resource: {
      mode: 'add',
      count: 1
    },
    castTimeMs: 0,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],
    effects: []
  },
  [ID.PHANTASMAL_WARLOCK]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 2920,
      damageAtMsByEntity: [2800, 2920],
      // Both Warlocks retain their observed attack and clone-conversion stagger.
      spawnAtMs: 4120,
      spawnAtMsByEntity: [4080, 4180],
      damageTicksByEntity: [
        {
          'One warlock': [{ atMs: 1200 }, { atMs: 2000 }, { atMs: 2800 }]
        },
        {
          'One warlock': [{ atMs: 1320 }, { atMs: 2120 }, { atMs: 2920 }]
        }
      ]
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 2
    },
    phantasmSummonProgress: 600 / 880,
    castTimeMs: 880,
    interruptCommitMs: 600,
    // Committed interrupts retain the full cast lockout and the phantasm launched at the fixed summon point.
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 1200, coefficient: 0.15 },
          { atMs: 2000, coefficient: 0.15 },
          { atMs: 2800, coefficient: 0.15 }
        ],
        name: 'One warlock',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'Phantasm high',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 4,
        stacks: 6,
        // Each Warlock hit applies its share immediately, including each entity's staggered attacks.
        packetLabel: 'One warlock',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        persistsAfterInterrupt: true
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.CHAOS_ARMOR]: {
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: [
      // The self aura must reach aura-gain traits independently of the offensive conditions.
      {
        type: 'aura',
        name: AURA.CHAOS,
        actorType: ACTOR.PLAYER,
        aura: AURA.CHAOS,
        duration: 5
      },
      // The activation blinds once for five seconds, independently of its Confusion.
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        source: 'Player',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 5,
        stacks: 3
      }
    ]
  },
  [ID.CHAOS_STORM]: {
    castTimeMs: 480,
    // Once the field's opening impact lands, cancelling the aftercast preserves its remaining pulses.
    interruptCommitMs: CHAOS_STORM_PULSES_MS[0],
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: COMBO_FIELD.ETHEREAL,
        duration: 5,
        // The field exists on its opening impact, allowing an instant Phase Retreat during the aftercast to combo.
        startAnchor: 'castStart',
        startMs: CHAOS_STORM_PULSES_MS[0]
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: CHAOS_STORM_PULSES_MS.map((atMs) => ({ atMs, coefficient: 0.33 })),
        name: 'Six pulses',
        actorType: ACTOR.PLAYER
      },
      {
        // Only the first impact dazes; subsequent field pulses do not repeat the CC.
        type: 'control',
        controlKind: CONTROL.DAZE,
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: CHAOS_STORM_PULSES_MS[0]
      }
    ]),
    sideEffects: [
      {
        on: 'castStart',
        do: {
          id: 'poison',
          type: 'mesmer.core.chaos-storm-poison',
          effects: [
            {
              name: 'Poison',
              type: 'condition',
              ticks: CHAOS_STORM_PULSES_MS.map((atMs) => ({
                atMs,
                condition: CONDITION.POISONED,
                duration: 4,
                stacks: 1
              })),
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ]
        }
      }
    ]
  }
});
