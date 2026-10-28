/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Haskha's log places the flock's first hit near 1,080 ms, followed by fixed 280 ms attacks.
const huntersCallHitTimes = Array.from({ length: 16 }, (_, index) => 1080 + index * 280);

export const RANGER_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HUNTERS_CALL]: {
    castTimeMs: 1240,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: huntersCallHitTimes.map((atMs) => ({ atMs, coefficient: 0.15 }))
      },
      {
        type: 'condition',
        // Each bird hit adds its own stack so Vulnerability builds over the attack sequence.
        ticks: huntersCallHitTimes.map((atMs) => ({ atMs, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5 }))
      }
    ])
  },
  [ID.CALL_OF_THE_WILD]: {
    castTimeMs: 600,
    comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.BLAST }],
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 12,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 12,
        stacks: 6,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 12,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  }
});
