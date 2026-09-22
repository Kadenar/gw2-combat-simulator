/**
 * Pistol weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 pistol position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Stocking and spending bullets is keyed by skill id elsewhere (the core
 * `PISTOL_SKILL_ELEMENTS` table), so nothing in this file mutates bullet state.
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
