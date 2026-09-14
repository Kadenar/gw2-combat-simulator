/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PHANTASMAL_LANCER]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 520,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mesmer attack',
        actorType: 'player',
        weapon: 'spear'
      },
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'One lancer',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 0
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 2,
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 1
      }
    ],
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    }
  },
  [ID.MENTAL_COLLAPSE]: {
    shadowstepSkill: true,
    peithaProjectileDelay: 0.8,
    handlerId: 'mesmer.mental-collapse',
    // Only the initial impact stuns when this activation consumed Clarity.
    clarityEffects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'stun',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 640,
    // Preserve the impact when interruption only skips the remaining recovery.
    interruptCommitMs: 600,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        // The initial impact precedes recovery; the two follow-up hits resolve afterward.
        ticks: [
          { atMs: 560, coefficient: 1 },
          { atMs: 840, coefficient: 1 },
          { atMs: 1120, coefficient: 1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.PSYSTRIKE]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 520,
    cooldown: 0,
    nextChainId: ID.MIND_PIERCE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.MIND_THE_GAP]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 600,
    // Committed interrupts preserve the attack while its full cast still occupies the casting lane.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 5,
    // The impact uses the next action tick after 480 ms so a just-prior shatter cannot consume this clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 520
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Outer-edge damage',
        actorType: 'player',
        weapon: 'spear',
        // The impact lands before the retained aftercast, alongside the clone gain.
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIND_PIERCE]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 560,
    cooldown: 0,
    nextChainId: null,
    // The chain finisher applies weakness as a real target condition, independent of relic triggers.
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        // The finisher lands before its cast recovery ends.
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.IMAGINARY_INVERSION]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    castTimeMs: 680,
    interruptCommitMs: 600,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.4 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PSYCUT]: {
    type: 'Weapon',
    weapon: 'Spear',
    specialization: '',
    // The attack commits before its full cast animation finishes.
    interruptCommitMs: 360,
    cooldown: 0,
    nextChainId: ID.PSYSTRIKE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        // Resolve the hit before the remaining cast recovery.
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ],
    castTimeMs: 400
  }
});
