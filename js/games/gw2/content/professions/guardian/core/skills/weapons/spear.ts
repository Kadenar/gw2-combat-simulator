/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HELIO_RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 6.4,
    ammo: 2,
    // Helio occupies the action lane for at most 440 ms, but collision or a
    // queued cancel can release it on any action tick from 280 ms onward.
    interruptCommitMs: 280,
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
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 9.6,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 0 + index * 680, coefficient: 3 / 2 })),
        name: 'Gleaming Disc',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DAYBREAKING_SLASH]: {
    implemented: true,
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
    implemented: true,
    castTimeMs: 560,
    unaffectedByQuickness: true,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.5 }],
        name: 'Solar Storm — 1st Strike',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 1.2 }],
        name: 'Solar Storm — 2nd Strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 960, coefficient: 0.9 }],
        name: 'Solar Storm — 3rd Strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SYMBOL_OF_LUMINANCE]: {
    implemented: true,
    castTimeMs: 440,
    unaffectedByQuickness: true,
    cooldown: 15,
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
