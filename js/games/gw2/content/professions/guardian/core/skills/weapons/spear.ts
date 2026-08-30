/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HELIO_RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    cooldown: 6.4,
    ammo: 2,
    // Helio commits its packet at 240 ms and can release the action lane at
    // the observed 280 ms cancel point.
    paletteInterruptMs: 280,
    interruptCommitMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 240,
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
        coefficient: 3,
        hits: 2,
        atMs: 0,
        intervalMs: 680,
        name: 'Gleaming Disc',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DAYBREAKING_SLASH]: {
    implemented: true,
    castTimeMs: 520,
    // Damage arrives around 400 ms; a committed cancel preserves the
    // remainder of the current animation variant's action lane.
    paletteInterruptMs: 400,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        atMs: 400,
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
        coefficient: 1.5,
        hits: 1,
        atMs: 560,
        name: 'Solar Storm — 1st Strike',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 760,
        name: 'Solar Storm — 2nd Strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        atMs: 960,
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
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 360,
        name: 'Symbol of Luminance — Initial',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 360,
        intervalMs: 1000,
        name: 'Symbol of Luminance',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
