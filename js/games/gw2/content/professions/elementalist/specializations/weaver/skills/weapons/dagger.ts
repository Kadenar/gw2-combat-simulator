/**
 * Dagger weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 dagger position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against the quickened timeline given by `quicknessCastTimeMs` and
 * are scaled back out for slower casts by the cast-scaled scheduler policy.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/**
 * The six dagger dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair (Fire+Water,
 * Fire+Air, Fire+Earth, Air+Water, Water+Earth, Air+Earth).
 */
export const WEAVER_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Fire+Water. The only dagger dual that lays a combo field: a four-second
  // Water field opening at cast end. Its own strike declares no finisher.
  [ID.STEAM_SURGE]: {
    name: 'Steam Surge',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 18,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Air. Single hit that doubles as a Blast finisher into the oldest
  // ambiguous field.
  [ID.PLASMA_BURST]: {
    name: 'Plasma Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 2,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Burning',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Earth. Two stages: a token 0.1 packet at 440 ms that exists to carry
  // the blind, then the real 1.4 hit plus Burning at 920 ms.
  [ID.ASHEN_BLAST]: {
    name: 'Ashen Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 920,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 440,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 920,
            coefficient: 1.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 920,
            condition: 'Burning',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  },
  // Air+Water. Two crowd-control applications far apart on the timeline: the
  // opening 0.1 packet at 234 ms carries the Blast finisher, Chilled,
  // Regeneration and the first control, while the 1.25 payoff hit and second
  // control land at 1514 ms - long after the 280 ms cast has ended.
  [ID.KATABATIC_WIND]: {
    name: 'Katabatic Wind',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 280,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 234,
            coefficient: 0.1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 234,
            condition: 'Chilled',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        atMs: 234,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 234,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1514,
            coefficient: 1.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 1514,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    specialization: 'Weaver'
  },
  // Water+Earth. Effectively a pure control skill: the 0.15 packet exists to
  // deliver the crowd-control application, not damage.
  [ID.MUD_SLIDE]: {
    name: 'Mud Slide',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1000,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 960,
            coefficient: 0.15
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 960,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    specialization: 'Weaver'
  },
  // Air+Earth. Six 0.275 pulses on a 520 ms cadence from 920 ms to 3520 ms,
  // each stacking Bleeding; the damage keeps running well past the 600 ms cast.
  // Stability is granted once, on the first pulse only.
  [ID.GRINDING_STONES]: {
    name: 'Grinding Stones',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 920,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 920,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Stability',
        stacks: 1,
        duration: 5,
        atMs: 920,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1440,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1440,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1960,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1960,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2480,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 2480,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 3000,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 3000,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 3520,
            coefficient: 0.275
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 3520,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    specialization: 'Weaver'
  }
});
