/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ETHER_FEAST]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 20,
    effects: []
  },
  [ID.MIRROR]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 833.333333333,
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
    quicknessCastTimeMs: 1500,
    cooldown: 1,
    effects: []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    type: 'Heal',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 1500,
    cooldown: 10,
    effects: []
  },
  [ID.SIGNET_OF_DOMINATION]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 166.666666667,
    cooldown: 25,
    effects: []
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: []
  },
  [ID.MASS_INVISIBILITY]: {
    type: 'Elite',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 833.333333333,
    cooldown: 35,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 1680,
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
    castTimeMs: 1140
  },
  [ID.FEEDBACK]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 32,
    effects: []
  },
  [ID.TIME_WARP]: {
    type: 'Elite',
    weapon: '',
    specialization: '',
    castTimeMs: 960,
    cooldown: 120,
    effects: []
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
    quicknessCastTimeMs: 770
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
    quicknessCastTimeMs: 919
  },
  [ID.SIGNET_OF_HUMILITY]: {
    type: 'Elite',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 45,
    effects: []
  },
  [ID.MIMIC]: {
    type: 'Utility',
    weapon: '',
    specialization: '',
    quicknessCastTimeMs: 640,
    cooldown: 20,
    effects: []
  }
});
