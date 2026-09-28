import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
/**
 * Pistol weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 pistol position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Definitions select the enhanced payloads and declare the final shared bullet settlement.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * The six pistol dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Fire+Water. Three-shot burst at 280/440/640 ms; the opening shot chills and
  // the two follow-ups each stack Burning.
  [ID.FROSTFIRE_FLURRY]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Fire,
        do: { type: 'elementalist.weaver.pistol.frostfire-fire' }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Water,
        do: { type: 'elementalist.weaver.pistol.frostfire-water' }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Frostfire Flurry',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 2.5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 5, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  // Fire+Air. Single Projectile finisher carrying the blind and five stacks of
  // Vulnerability.
  [ID.PURBLINDING_PLASMA]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Fire,
        do: { type: 'elementalist.weaver.pistol.plasma-fire' }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Purblinding Plasma',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'blind', applications: 1, controlKind: 'blind' },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.MOLTEN_METEOR]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Earth,
        do: { type: 'elementalist.weaver.pistol.meteor-earth' }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Molten Meteor',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 8, metadata: {} },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  // Air+Water. The one dual with no offensive packet at all: it only self-boons
  // (Regeneration and Stability) at cast start.
  [ID.FLOWING_FINESSE]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Water,
        do: { type: 'elementalist.weaver.pistol.finesse-water' }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Air,
        do: { type: 'elementalist.weaver.pistol.finesse-air' }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Flowing Finesse',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 880,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: 'Regeneration', stacks: 1, duration: 5, metadata: {} },
      { type: 'boon', boon: 'Stability', stacks: 1, duration: 5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  // Water+Earth. Two shots at 280/480 ms, each applying two Bleeding stacks.
  [ID.ECHOING_EROSION]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }],
    name: 'Echoing Erosion',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8, metadata: {} }
      ]),
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8, metadata: {} }
      ])
    ],
    specialization: 'Weaver'
  },
  // Air+Earth. Single Projectile finisher carrying Weakness and Cripple.
  [ID.ENERVATING_EARTH]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Air,
        do: { type: 'elementalist.weaver.pistol.enervating-air' }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Earth,
        do: { type: 'elementalist.weaver.pistol.enervating-earth' }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Enervating Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3, metadata: {} },
      { type: 'condition', condition: 'Cripple', stacks: 1, duration: 4, metadata: {} }
    ]),
    specialization: 'Weaver'
  }
});
