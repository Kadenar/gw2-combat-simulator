/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Instant shouts share boons with the party while spent charges recharge independently of the use lockout.
  [ID.ADVANCE]: {
    castTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 24,
    ammoCastLockout: 5,
    effects: [
      { type: 'boon', boon: 'swiftness', duration: 20, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'aegis', duration: 20, audience: { recipients: 'party' } }
    ]
  },
  [ID.HOLD_THE_LINE]: {
    castTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    ammoCastLockout: 5,
    effects: [
      { type: 'boon', boon: 'protection', duration: 6, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'regeneration', duration: 6, audience: { recipients: 'party' } }
    ]
  },
  [ID.RECEIVE_THE_LIGHT]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.BANE_SIGNET]: {
    // Use the reviewed activation duration so damage and control resolve at cast completion.
    castTimeMs: 880,
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
    castTimeMs: 680,
    effects: []
  },
  [ID.HAMMER_OF_WISDOM]: {
    castTimeMs: 200,
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
    castTimeMs: 200,
    effects: []
  },
  [ID.SIGNET_OF_WRATH]: {
    // The active commits before the Quickness cast finishes, allowing the remaining recovery to be canceled.
    castTimeMs: 880,
    interruptCommitMs: 820,
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
    castTimeMs: 1360,
    // Custom: Refreshes all virtue cooldowns and readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.renewed-focus',
    effects: []
  },
  [ID.SIGNET_OF_RESOLVE]: {
    castTimeMs: 680,
    effects: []
  },
  [ID.SWORD_OF_JUSTICE]: {
    castTimeMs: 600,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        // Include the spirit's arrival delay: four strikes begin 1320 ms after cast start, 400 ms apart.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({ atMs, coefficient: 0.8 }))
      },
      {
        type: 'condition',
        // Every sword packet applies its own Vulnerability at the matching impact time.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 8
        }))
      }
    ])
  },
  [ID.PURGING_FLAMES]: {
    castTimeMs: 320,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [320, 1320, 2320, 3320, 4320, 5320].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      // Each field pulse applies the same Burning packet alongside its strike.
      ...[320, 1320, 2320, 3320, 4320, 5320].map((atMs) => ({
        type: 'condition' as const,
        ticks: [{ atMs, condition: 'Burning', stacks: 1, duration: 2 }]
      }))
    ])
  },
  [ID.JUDGES_INTERVENTION]: {
    castTimeMs: 200,
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
    castTimeMs: 680,
    effects: []
  },
  [ID.FEEL_MY_WRATH]: {
    castTimeMs: 400,
    cooldown: 30,
    effects: [
      { type: 'boon', boon: 'quickness', duration: 3, audience: { recipients: 'party' as const } },
      // The party application includes the caster, so this supplement doubles only the caster's duration to six seconds.
      { type: 'boon', boon: 'quickness', duration: 3, audience: { recipients: 'self' as const } },
      { type: 'boon', boon: 'fury', duration: 10, audience: { recipients: 'party' as const } }
    ]
  }
});
