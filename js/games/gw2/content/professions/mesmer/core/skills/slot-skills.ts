/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ETHER_FEAST]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 20,
    effects: []
  },
  [ID.MIRROR]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 833.333333333,
    cooldown: 12,
    effects: []
  },
  [ID.MIRROR_IMAGES]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
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
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1500,
    cooldown: 1,
    effects: []
  },
  [ID.MANTRA_OF_RECOVERY]: {
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 1500,
    cooldown: 10,
    effects: []
  },
  [ID.SIGNET_OF_DOMINATION]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 166.666666667,
    cooldown: 25,
    effects: []
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: []
  },
  [ID.MASS_INVISIBILITY]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 833.333333333,
    cooldown: 35,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
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
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
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
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 32,
    effects: []
  },
  [ID.TIME_WARP]: {
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    castTimeMs: 960,
    cooldown: 120,
    effects: []
  },
  [ID.PHANTASMAL_DEFENDER]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
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
    implemented: true,
    type: 'Heal',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
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
    implemented: true,
    type: 'Elite',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 666.666666667,
    cooldown: 45,
    effects: []
  },
  [ID.MIMIC]: {
    implemented: true,
    type: 'Utility',
    weapon: '',
    specialization: '',
    environment: 'Terrestrial',
    quicknessCastTimeMs: 640,
    cooldown: 20,
    effects: []
  }
});
