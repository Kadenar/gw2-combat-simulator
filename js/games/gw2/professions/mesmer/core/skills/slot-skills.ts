/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Reviewed activation durations keep completion effects and resource changes on their intended action ticks.
export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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
    castTimeMs: 1600,
    effects: []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    castTimeMs: 1500,
    effects: []
  },
  [ID.SIGNET_OF_DOMINATION]: {
    castTimeMs: 480,
    // Signet activation applies its control when the cast completes.
    effects: [
      { type: 'control', source: 'Player', actorType: 'player', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ]
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    // Activating the signet applies one five-second blind.
    effects: [{ type: 'blind', duration: 5, source: 'Player', actorType: 'player' }]
  },
  [ID.MASS_INVISIBILITY]: {
    castTimeMs: 1080,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    castTimeMs: 1120,
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
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    // Feedback's dome provides an ethereal combo field for its six-second lifetime.
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 6, startAnchor: 'castStart' }],
    effects: []
  },
  [ID.TIME_WARP]: {
    castTimeMs: 640,
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
          controlKind: 'taunt',
          source: 'Player',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Taunt',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        }
      ]),
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
    castTimeMs: 760
  },
  [ID.SIGNET_OF_THE_ETHER]: {
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
    castTimeMs: 880,
    // Signet activation applies its control when the cast completes.
    effects: [
      { type: 'control', source: 'Player', actorType: 'player', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }
    ]
  },
  [ID.MIMIC]: {
    castTimeMs: 640,
    effects: []
  }
});
