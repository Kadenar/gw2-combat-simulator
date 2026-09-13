/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ETHER_FEAST]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    castTimeMs: 666.666666667,
    cooldown: 20,
    effects: []
  },
  [ID.MIRROR]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    castTimeMs: 833.333333333,
    cooldown: 12,
    effects: []
  },
  [ID.MIRROR_IMAGES]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 25,
    resource: {
      mode: 'add',
      count: 2
    },
    effects: []
  },
  [ID.MANTRA_OF_PAIN]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 1500,
    cooldown: 1,
    effects: []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    castTimeMs: 1500,
    cooldown: 10,
    effects: []
  },
  [ID.SIGNET_OF_DOMINATION]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 166.666666667,
    cooldown: 25,
    // Signet activation applies its control when the cast completes.
    effects: [
      { type: 'control', source: 'Player', actorType: 'player', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ]
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    // Activating the signet applies one five-second blind.
    effects: [{ type: 'blind', duration: 5, source: 'Player', actorType: 'player' }]
  },
  [ID.MASS_INVISIBILITY]: {
    type: 'Elite',
    weapon: '',
    specialization: '',
    castTimeMs: 833.333333333,
    cooldown: 35,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 1120,
    cooldown: 60,
    // Restart the passive clone interval only after the active cast completes.
    mechanicTriggers: [
      {
        type: 'mesmer.core.restart-signet-illusions-passive',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    cooldown: 20,
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
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 760
  },
  [ID.FEEDBACK]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 32,
    // Feedback's dome provides an ethereal combo field for its six-second lifetime.
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 6, startAnchor: 'castStart' }],
    effects: []
  },
  [ID.TIME_WARP]: {
    type: 'Elite',
    weapon: '',
    specialization: '',
    castTimeMs: 640,
    cooldown: 120,
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 5, startAnchor: 'castEnd' }],
    // Apply an immediate pulse when the field forms, then pulse once per second through its fifth second.
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'superspeed',
        duration: 1.5,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PHANTASMAL_DEFENDER]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    cooldown: 40,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      // Keep the existing cast-completion control alongside the phantasm's effects.
      {
        type: 'control',
        source: 'Player',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Damage',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm defender'
      }
    ],
    castTimeMs: 770
  },
  [ID.SIGNET_OF_THE_ETHER]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    cooldown: 30,
    // The live skill re-locks itself 300ms after completion despite resetting phantasms immediately.
    mechanicTriggers: [
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
    type: 'Elite',
    weapon: '',
    specialization: '',
    castTimeMs: 666.666666667,
    cooldown: 45,
    // Signet activation applies its control when the cast completes.
    effects: [
      { type: 'control', source: 'Player', actorType: 'player', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ]
  },
  [ID.MIMIC]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 640,
    cooldown: 20,
    effects: []
  }
});
