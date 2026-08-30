/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CLEANSING_FLAME]: {
    implemented: true,
    interruptMode: 'per-packet',
    // The catalog derives the unquickened cast from this measured Quickness duration.
    quicknessCastTimeMs: 2600,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 10,
        atMs: 260,
        intervalMs: 260,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 4,
        atMs: 2600,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ZEALOTS_FIRE]: {
    implemented: true,
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
        condition: 'Burning',
        stacks: 3,
        duration: 3,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ZEALOTS_FLAME]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 15,
    ammo: 1,
    ammoRecharge: 15,
    ammoCastLockout: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        applications: 4,
        intervalMs: 1000,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
