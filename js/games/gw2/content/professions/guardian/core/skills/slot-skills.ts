/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RECEIVE_THE_LIGHT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.ADVANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.SAVE_YOURSELVES]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.BANE_SIGNET]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.SHELTER]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.HAMMER_OF_WISDOM]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.SANCTUARY]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.SIGNET_OF_JUDGMENT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.SIGNET_OF_WRATH]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 18,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 5
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.HOLD_THE_LINE]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.STAND_YOUR_GROUND]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.RENEWED_FOCUS]: {
    implemented: true,
    castTimeMs: 2000,
    handlerId: 'guardian.renewed-focus',
    effects: []
  },
  [ID.SIGNET_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.SIGNET_OF_MERCY]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.SWORD_OF_JUSTICE]: {
    implemented: true,
    // Store the measured Quickness cast and derive the 900ms unquickened baseline.
    quicknessCastTimeMs: 600,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        // Preserve the measured four-packet spirit cadence explicitly from cast start.
        ticks: [650, 1050, 1450, 1850].map((atMs) => ({ atMs, coefficient: 0.8 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Every sword packet applies its own Vulnerability at the matching impact time.
        ticks: [650, 1050, 1450, 1850].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 8
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BOW_OF_TRUTH]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.SHIELD_OF_THE_AVENGER]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.PURGING_FLAMES]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [320, 1320, 2320, 3320, 4320, 5320].map((atMs) => ({
          atMs,
          coefficient: 0.2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 3320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 4320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 5320, condition: 'Burning', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SMITE_CONDITION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.9,
        hits: 1,
        name: 'Smite Condition — Damage With Condition'
      }
    ]
  },
  [ID.MERCIFUL_INTERVENTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.JUDGES_INTERVENTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.CONTEMPLATION_OF_PURITY]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.WALL_OF_REFLECTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.HALLOWED_GROUND]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.LITANY_OF_WRATH]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.FEEL_MY_WRATH]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        recipients: 'allies'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        recipients: 'self'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        recipients: 'party'
      }
    ]
  },
  [ID.SIGNET_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  },
  [ID.SHIELD_OF_THE_AVENGER_ID_41571]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.BOW_OF_TRUTH_ID_43565]: {
    implemented: true,
    castTimeMs: 250,
    effects: []
  },
  [ID.SWORD_OF_JUSTICE_ID_44846]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 3.2,
        hits: 4
      }
    ]
  },
  [ID.HAMMER_OF_WISDOM_ID_46170]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.RENEWED_FOCUS_ID_68666]: {
    implemented: true,
    castTimeMs: 1000,
    handlerId: 'guardian.renewed-focus',
    effects: []
  },
  [ID.FEEL_MY_WRATH_ID_68670]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        recipients: 'allies'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        recipients: 'self'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        recipients: 'party'
      }
    ]
  },
  [ID.SIGNET_OF_COURAGE_ID_68676]: {
    implemented: true,
    castTimeMs: 1000,
    effects: []
  }
});
