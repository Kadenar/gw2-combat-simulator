/**
 * Dagger weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 dagger position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against castTimeMs and follow runtime skill variants through the shared scheduler policy.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * The six dagger dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair (Fire+Water,
 * Fire+Air, Fire+Earth, Air+Water, Water+Earth, Air+Earth).
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Fire+Water. The only dagger dual that lays a combo field: a four-second
  // Water field opening at cast end. Its own strike declares no finisher.
  [ID.STEAM_SURGE]: {
    name: 'Steam Surge',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 560,
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
    castTimeMs: 600,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 6, metadata: {} }
    ]),
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
    castTimeMs: 920,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.1 },
        { type: 'blind', applications: 1, controlKind: 'blind' }
      ]),
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.4 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 8, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  // Air+Water. Two crowd-control applications far apart on the timeline: the
  // opening 0.1 packet at 240 ms carries the Blast finisher, Chilled,
  // Regeneration and the first control, while the 1.25 payoff hit and second
  // control land at 1520 ms - long after the 280 ms cast has ended.
  [ID.KATABATIC_WIND]: {
    name: 'Katabatic Wind',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 280,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.1,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {},
          canCrit: true
        },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, metadata: {} },
        { type: 'boon', boon: 'Regeneration', stacks: 1, duration: 4, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]),
      ...impactEffects({ atMs: 1520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.25, canCrit: true },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ])
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
    castTimeMs: 1000,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.15, canCrit: true },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ]),
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
    castTimeMs: 600,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} },
        { type: 'boon', boon: 'Stability', stacks: 1, duration: 5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1960, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 2480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 3000, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 3520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  }
});
