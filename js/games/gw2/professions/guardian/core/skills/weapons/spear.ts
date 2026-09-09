/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HELIO_RUSH]: {
    quicknessCastTimeMs: 440,
    // Consecutive charges lock for two seconds while each spent count recharges over eight seconds.
    cooldown: 2,
    ammo: 2,
    ammoRecharge: 8,
    ammoCastLockout: 2,
    // Helio occupies the action lane for at most 440 ms, but collision or a
    // queued cancel can release it on any action tick from 240 ms onward.
    interruptCommitMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Resolution',
        duration: 4,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GLEAMING_DISC]: {
    quicknessCastTimeMs: 560,
    // The disc commits at 520 ms, allowing a queued cancel to release the remaining animation.
    interruptCommitMs: 520,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        // The first impact follows the windup; the shock wave lands 680 ms later.
        ticks: [480, 1160].map((atMs) => ({ atMs, coefficient: 3 / 2 })),
        name: 'Gleaming Disc',
        // The launched disc and delayed shock wave survive cancellation of the remaining animation.
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DAYBREAKING_SLASH]: {
    quicknessCastTimeMs: 560,
    // Damage commits at 400 ms, allowing a queued cancel to release the action lane early.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SOLAR_STORM]: {
    castTimeMs: 560,
    unaffectedByQuickness: true,
    // The volley commits before impact; cancelling the remaining animation preserves its delayed strikes.
    interruptCommitMs: 480,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        // Shards begin 1120 ms after activation, after the cast and projectile delay.
        ticks: [{ atMs: 1120, coefficient: 1.5 }],
        name: 'Solar Storm — 1st Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1320, coefficient: 1.2 }],
        name: 'Solar Storm — 2nd Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1520, coefficient: 0.9 }],
        name: 'Solar Storm — 3rd Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SYMBOL_OF_LUMINANCE]: {
    castTimeMs: 440,
    unaffectedByQuickness: true,
    cooldown: 20,
    // The Light field begins on the initial impact and lasts four seconds.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 360, startAnchor: 'castStart' }],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 1.5 }],
        name: 'Symbol of Luminance — Initial',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 360 + index * 1000, coefficient: 2.5 / 5 })),
        name: 'Symbol of Luminance',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        // The knockback belongs to the initial impact, not the recurring symbol pulses.
        type: 'control',
        controlKind: 'knockback',
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
