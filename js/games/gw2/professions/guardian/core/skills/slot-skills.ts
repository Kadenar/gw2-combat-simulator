/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RECEIVE_THE_LIGHT]: {
    castTimeMs: 1000,
    effects: []
  },
  [ID.ADVANCE]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.SAVE_YOURSELVES]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.BANE_SIGNET]: {
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.SHELTER]: {
    castTimeMs: 1000,
    effects: []
  },
  [ID.HAMMER_OF_WISDOM]: {
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.SANCTUARY]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.SIGNET_OF_WRATH]: {
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
    castTimeMs: 250,
    effects: []
  },
  [ID.STAND_YOUR_GROUND]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.RENEWED_FOCUS]: {
    castTimeMs: 2000,
    // Custom: Refreshes all virtue cooldowns and readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.renewed-focus',
    effects: []
  },
  [ID.SIGNET_OF_RESOLVE]: {
    castTimeMs: 1000,
    effects: []
  },
  [ID.SIGNET_OF_MERCY]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.SWORD_OF_JUSTICE]: {
    quicknessCastTimeMs: 600,
    // Can be interrupted at 400ms but retains lockout
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
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
    castTimeMs: 250,
    effects: []
  },
  [ID.PURGING_FLAMES]: {
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
  [ID.MERCIFUL_INTERVENTION]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.JUDGES_INTERVENTION]: {
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
    castTimeMs: 250,
    effects: []
  },
  [ID.WALL_OF_REFLECTION]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.HALLOWED_GROUND]: {
    castTimeMs: 250,
    effects: []
  },
  [ID.LITANY_OF_WRATH]: {
    castTimeMs: 1000,
    effects: []
  },
  [ID.FEEL_MY_WRATH]: {
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: [
      { type: 'boon', boon: 'quickness', duration: 3, audience: { recipients: 'party' as const } },
      // The party application includes the caster, so this supplement doubles only the caster's duration to six seconds.
      { type: 'boon', boon: 'quickness', duration: 3, audience: { recipients: 'self' as const } },
      { type: 'boon', boon: 'fury', duration: 10, audience: { recipients: 'party' as const } }
    ]
  }
});
