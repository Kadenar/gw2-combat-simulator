/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RECEIVE_THE_LIGHT]: {
    castTimeMs: 1000,
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
  [ID.SWORD_OF_JUSTICE]: {
    quicknessCastTimeMs: 600,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        // Include the spirit's arrival delay: four strikes begin 1320 ms after cast start, 400 ms apart.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({ atMs, coefficient: 0.8 })),
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Every sword packet applies its own Vulnerability at the matching impact time.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 8
        })),
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
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
