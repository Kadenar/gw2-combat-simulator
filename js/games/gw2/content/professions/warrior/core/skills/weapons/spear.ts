/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MAIMING_SPEAR]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Maiming Spear — Initial Strike Damage',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        // Base aftershock coefficient is 0.75; the aftershock deals 50% more to
        // the foe closest to the epicenter (per the skill fact). On a single
        // target that foe is always the golem, so the effective coefficient is
        // 0.75 * 1.5 = 1.125. The epicenter bonus is folded in here because the
        // simulator has no target-position model to gate it on.
        coefficient: 1.125,
        hits: 1,
        name: 'Maiming Spear — Aftershock Damage',
        atMs: 1517,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.MIGHTY_THROW]: {
    implemented: true,
    handlerId: 'warrior.mighty-throw',
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mighty Throw — Spear Damage',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Mighty Throw — Shard Damage',
        atMs: 466.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DISRUPTING_THROW]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 399.75,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 3
        }
      }
    ]
  },
  [ID.SPEARMARSHALS_SUPPORT]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 967, coefficient: 0.5 },
          { atMs: 1167, coefficient: 0.5 },
          { atMs: 1367, coefficient: 0.5 },
          { atMs: 1567, coefficient: 0.5 },
          { atMs: 1767, coefficient: 0.5 },
          { atMs: 1967, coefficient: 0.5 },
          { atMs: 2167, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SPEAR_SWIPE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'launch'
        }
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  }
});
