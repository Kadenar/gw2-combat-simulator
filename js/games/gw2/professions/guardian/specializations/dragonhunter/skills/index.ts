/**
 * Owns Dragonhunter virtue and trap skill fragments.
 * Runtime virtue and trap behavior remains under `mechanics/` and `execution/virtues.ts`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SPEAR_OF_JUSTICE]: {
    quicknessCastTimeMs: 560,
    // The virtue commits at 520 ms, allowing the remaining animation to be cancelled.
    interruptCommitMs: 520,
    cooldown: 20,
    // Custom: Tracks the tether, decorates its strike, and schedules justice pulses; see `dragonhunter/execution/virtues.ts`.
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
        // The spear hits before the remaining virtue animation releases the action lane.
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        weaponStrengthSource: 'equipped'
      }
    ]
  },
  [ID.PURIFICATION]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        // Damage and blindness arrive after the trap's placement and trigger delay.
        ticks: [{ atMs: 1560, coefficient: 0.1875 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        duration: 6,
        atMs: 1560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHIELD_OF_COURAGE]: {
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.WINGS_OF_RESOLVE]: {
    castTimeMs: 0,
    cooldown: 25,
    // Custom: Runs the core virtue transition plus Dragonhunter virtue traits; see `dragonhunter/execution/virtues.ts`.
    handlerId: 'guardian.dragonhunter-virtue',
    effects: []
  },
  [ID.DRAGONS_MAW]: {
    castTimeMs: 660,
    effects: [
      {
        type: 'strike',
        // The closing maw deals damage and applies control after its initial trigger.
        ticks: [{ atMs: 1400, coefficient: 3.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'pull',
        atMs: 1400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1400, condition: 'Slow', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 10,
        duration: 8,
        // Might is granted when the trap triggers, before the jaws deal damage.
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PROCESSION_OF_BLADES]: {
    castTimeMs: 660,
    effects: [
      {
        type: 'strike',
        // Include the cast windup: the first blade hits at 1720 ms, then pulses every 280 ms.
        ticks: [1720, 2000, 2280, 2560, 2840, 3120, 3400, 3680, 3960, 4240].map((atMs) => ({
          atMs,
          coefficient: 0.44
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FRAGMENTS_OF_FAITH]: {
    castTimeMs: 250,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.HUNTERS_VERDICT]: {
    castTimeMs: 0,
    cooldown: 40,
    // Custom: Breaks the active Spear of Justice tether and cancels later pulses; see `dragonhunter/execution/virtues.ts`.
    handlerId: 'guardian.hunters-verdict',
    effects: [
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  }
});
