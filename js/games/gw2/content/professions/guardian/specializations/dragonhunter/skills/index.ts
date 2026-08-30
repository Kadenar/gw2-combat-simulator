import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TEST_OF_FAITH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SPEAR_OF_JUSTICE]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 20,
    handlerId: 'guardian.dragonhunter-justice',
    // The completed tether activation exposes Hunter's Verdict for the tether window.
    mechanicTriggers: [
      {
        type: 'guardian.dragonhunter.arm-hunters-verdict',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        weaponStrengthSource: 'equipped'
      }
    ]
  },
  [ID.PURIFICATION]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1875,
        hits: 1,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        metadata: {
          duration: 6
        }
      }
    ]
  },
  [ID.SHIELD_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.WINGS_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    handlerId: 'guardian.dragonhunter-virtue',
    effects: []
  },
  [ID.DRAGONS_MAW]: {
    implemented: true,
    castTimeMs: 660,
    effects: [
      {
        type: 'strike',
        coefficient: 3.6,
        hits: 1,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'pull'
        }
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 4,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 10,
        duration: 8,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PROCESSION_OF_BLADES]: {
    implemented: true,
    castTimeMs: 660,
    effects: [
      {
        type: 'strike',
        ticks: [1280, 1560, 1840, 2120, 2400, 2680, 2960, 3240, 3520, 3800].map((atMs) => ({
          atMs,
          coefficient: 0.44
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FRAGMENTS_OF_FAITH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.LIGHTS_JUDGMENT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1875,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'pull'
        }
      }
    ]
  },
  [ID.HUNTERS_VERDICT]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 40,
    handlerId: 'guardian.hunters-verdict',
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'pull'
        }
      }
    ]
  },
  [ID.DRAGONS_MAW_ID_68686]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 3.6,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  }
});
