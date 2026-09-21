/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.KEEN_STRIKE]: {
    interruptCommitMs: 280,
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.05
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ])
  },
  [ID.FOCUSED_SLASH]: {
    castTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PRECISE_CUT]: {
    castTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WASTRELS_RUIN]: {
    interruptCommitMs: 400,
    cooldown: 12,
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DISRUPTING_STAB]: {
    castTimeMs: 440,
    dualWieldCastTimeMs: 320,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.HUSHBLADE]: {
    interruptCommitMs: 440,
    ammo: 2,
    ammoRecharge: 12,
    cooldown: 12,
    ammoCastLockout: 1,
    castTimeMs: 520,
    dualWieldCastTimeMs: 400,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  [ID.AURA_SLICER]: {
    // Aura Slicer ignores Quickness and Dual Wielding, so its observed timing stays fixed.
    interruptCommitMs: 760,
    castTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],

    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5
      }
    ])
  }
});
