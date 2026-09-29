import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const WILLBENDER_BALANCE_PROFILE_IDS = Object.freeze({
  flames: 'guardian.willbender.flames',
  virtueWindows: 'guardian.willbender.virtue-windows',
  courageTrigger: 'guardian.willbender.courage-trigger'
});

export const WILLBENDER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.flames,
    name: 'Willbender Flames',
    profileKind: 'skill-variant',
    parentId: ID.WILLBENDER_FLAMES,
    // Explicit strike ticks own the flame count and timing.
    effects: [
      {
        type: 'strike',
        name: 'Strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: (index + 1) * 1000, coefficient: 0.22 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.virtueWindows,
    name: 'Willbender Virtue Windows',
    profileKind: 'mechanic',
    threshold: 5,
    effects: [
      { type: 'buff', name: 'justice', kind: 'justice', stacks: 1, duration: 8 },
      { type: 'buff', name: 'resolve', kind: 'resolve', stacks: 1, duration: 6 },
      { type: 'buff', name: 'courage', kind: 'courage', stacks: 1, duration: 6 }
    ]
  },
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.courageTrigger,
    name: 'Crashing Courage - Trigger',
    profileKind: 'skill-variant',
    parentId: ID.CRASHING_COURAGE,
    effects: [
      { type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 4 },
      { type: 'boon', name: 'stability', boon: 'stability', stacks: 1, duration: 4 }
    ]
  }
]);
