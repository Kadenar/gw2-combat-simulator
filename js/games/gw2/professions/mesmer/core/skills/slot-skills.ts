import { ACTOR, COMBO_FIELD, RECIPIENT, STATUS, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

// Reviewed activation durations keep completion effects and resource changes on their intended action ticks.
export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.ETHER_FEAST]: {
    castTimeMs: 666.666666667,
    effects: []
  },
  [ID.MIRROR]: {
    castTimeMs: 833.333333333,
    effects: []
  },
  [ID.MIRROR_IMAGES]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    resource: {
      mode: 'add',
      count: 2
    },
    effects: []
  },
  [ID.MANTRA_OF_PAIN]: {
    // Preparation replaces spent charges and any previous recharge state.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.prepare-mantra' } }],
    castTimeMs: 1600,
    effects: []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    // Completing preparation restores the healing mantra's own two-charge flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.prepare-mantra' } }],
    castTimeMs: 1600,
    effects: []
  },
  [ID.SIGNET_OF_DOMINATION]: {
    castTimeMs: 480,
    // Signet activation applies its control when the cast completes.
    effects: [
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    // Activating the signet applies one five-second blind.
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        source: 'Player',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MASS_INVISIBILITY]: {
    castTimeMs: 1080,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    // Committed activation refreshes the selected catalog's eligible shatters and instruments.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.signet-reset' } }],
    castTimeMs: 1120,
    // Restart the passive clone interval only after the active cast completes.
    tasks: [
      {
        type: 'mesmer.core.restart-signet-illusions-passive',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 1240,
      // The dedicated lifecycle converts Disenchanter about 1.92s after cast completion.
      spawnAtMs: 1920
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Target without boons',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 760
  },
  [ID.FEEDBACK]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    // Feedback's dome provides an ethereal combo field for its six-second lifetime.
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 6, startAnchor: 'castStart' }],
    effects: []
  },
  [ID.TIME_WARP]: {
    castTimeMs: 640,
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 5, startAnchor: 'castEnd' }],
    // Apply an immediate pulse when the field forms, then pulse once per second through its fifth second.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.QUICKNESS,
        duration: 1,
        applications: 6,
        intervalMs: 1000
      },
      {
        type: 'buff',
        kind: STATUS.SUPERSPEED,
        duration: 1.5,
        applications: 6,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1,
        applications: 6,
        intervalMs: 1000
      }
    ])
  },
  [ID.PHANTASMAL_DEFENDER]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 3800,
      spawnAtMs: 4510
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      // Record the taunt's control trigger and three-second target condition at cast completion.
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'control',
          controlKind: CONTROL.TAUNT,
          source: 'Player',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TAUNT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm defender'
      }
    ],
    castTimeMs: 760
  },
  [ID.SIGNET_OF_THE_ETHER]: {
    // Reset phantasms at commitment; the delayed self-relock remains independent.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.signet-reset' } }],
    // The live skill re-locks itself 300ms after completion despite resetting phantasms immediately.
    tasks: [
      {
        type: 'mesmer.core.relock-signet-ether',
        atMs: 300,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    effects: [],
    castTimeMs: 920
  },
  [ID.SIGNET_OF_HUMILITY]: {
    castTimeMs: 880,
    // Signet activation applies its control when the cast completes.
    effects: [
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIMIC]: {
    // Arm a fresh utility-reset window at semantic completion.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-mimic' } }],
    castTimeMs: 640,
    effects: []
  }
});
