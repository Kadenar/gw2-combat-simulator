/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_PUNISHMENT]: {
    quicknessCastTimeMs: 320,
    cooldown: 10,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 4,
        startMs: 240,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        // Model all eight spatial Smite opportunities as hits at their observed cadence.
        ticks: [240, 760, 1240, 1760, 2240, 2760, 3240, 3760].map((atMs) => ({
          atMs,
          coefficient: 0.2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        // Main symbol damage begins one second after the initial boon pulse and lands once per second.
        ticks: [1240, 2240, 3240, 4240].map((atMs) => ({
          atMs,
          coefficient: 0.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...[240, 1240, 2240, 3240, 4240].map((atMs) => ({
        type: 'boon' as const,
        boon: 'might',
        stacks: 4,
        duration: 5,
        audience: { recipients: 'party' as const },
        atMs,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const
      }))
    ]
  },
  [ID.ORB_OF_WRATH]: {
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1
      }
    ]
  },
  [ID.CHAINS_OF_LIGHT]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  }
});
