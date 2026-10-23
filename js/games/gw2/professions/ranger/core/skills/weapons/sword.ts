import { RECIPIENT, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

// Measured with Quickness in 20261015-203144.zevtc, rounded to the 40 ms action grid.
// Apply each attack's hit rewards before recovery ends so completed impacts survive recovery cancellation.
export const RANGER_CORE_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SLASH]: {
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The live PvE skill fact is 0.9; 0.8 understates the opening chain strike.
        coefficient: 0.9,
        hits: 1
      }
    ]),
    castTimeMs: 480
  },
  [ID.CRIPPLING_THRUST]: {
    interruptCommitMs: 240,
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Match the live PvE chain coefficient.
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2
      }
    ]),
    castTimeMs: 320
  },
  [ID.PRECISION_SWIPE]: {
    interruptCommitMs: 520,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.SUMMONS, affectsSelf: false, maximumRecipients: 1 }
      }
    ]),
    castTimeMs: 600,
    retainsCastLockoutAfterInterrupt: true
  },
  [ID.SERPENTS_STRIKE]: {
    evades: true,
    interruptCommitMs: 800,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3
      }
    ]),
    castTimeMs: 1000,
    retainsCastLockoutAfterInterrupt: true
  },
  [ID.POUNCE]: {
    interruptCommitMs: 760,
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        damageKind: 'ranger-pounce-defiant',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      }
    ]),
    castTimeMs: 840
  }
});

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerPounceModifier: Gw2ModifierRule = {
  id: 'ranger.pounce-defiant',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.2,
  when: (context) => context.event?.damageKind === 'ranger-pounce-defiant' && Boolean(context.config?.target?.defiant)
};
