/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { strikeTimeline } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WAIL_OF_DOOM]: {
    castTimeMs: 1000,
    effects: [
      {
        type: 'control',
        controlKind: 'fear'
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    castTimeMs: 440,
    // Share the siphon formula across pulses, preserving independently rounded half-second offsets.
    effects: [
      strikeTimeline(
        [0, 520, 1000, 1520, 2000, 2520, 3000, 3520, 4000, 4520].map((atMs) => ({ atMs, coefficient: 0 })),
        {
          name: 'Locust Swarm — Life Siphon',
          flatStrikeBase: 37,
          flatStrikePowerCoeff: 0.012,
          noCrit: true,
          damageKind: 'life-steal',
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      )
    ],
    lifeForceGain: 1.5
  }
});
