/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Haskha's log places the flock's first hit near 1,080 ms, followed by fixed 280 ms attacks.
const huntersCallHitTimes = Array.from({ length: 16 }, (_, index) => 1080 + index * 280);

export const RANGER_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HUNTERS_CALL]: {
    effects: [
      {
        type: 'strike',
        ticks: huntersCallHitTimes.map((atMs) => ({ atMs, coefficient: 0.15 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Each bird hit adds its own stack so Vulnerability builds over the attack sequence.
        ticks: huntersCallHitTimes.map((atMs) => ({ atMs, condition: 'Vulnerability', stacks: 1, duration: 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 1240
  },
  [ID.CALL_OF_THE_WILD]: {
    comboFinishers: [{ ownerId: 'ranger', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }],
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 12,
        stacks: 6,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      },
      {
        type: 'control',
        controlKind: 'daze',
        duration: 2,
        breakbar: 200
      }
    ],
    quicknessCastTimeMs: 600
  }
});
