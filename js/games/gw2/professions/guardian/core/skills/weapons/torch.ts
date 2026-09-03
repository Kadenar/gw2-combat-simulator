/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CLEANSING_FLAME]: {
    interruptMode: 'per-packet',
    // The catalog derives the unquickened cast from this measured Quickness duration.
    quicknessCastTimeMs: 2600,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 10 }, (_, index) => ({ atMs: 260 + index * 260, coefficient: 4 / 10 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2600, condition: 'Burning', stacks: 2, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ZEALOTS_FIRE]: {
    quicknessCastTimeMs: 680,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Burning', stacks: 3, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ZEALOTS_FLAME]: {
    castTimeMs: 0,
    cooldown: 15,
    ammo: 1,
    ammoRecharge: 15,
    ammoCastLockout: 0,
    effects: [
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
