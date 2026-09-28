import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
/**
 * Owns Catalyst Jade Sphere and augment skill catalog fragments only.
 * Energy, sphere, and empowerment state lives under `mechanics/`.
 */
import { CATALYST_JADE_SPHERE_EFFECTS } from '#gw2/professions/elementalist/specializations/catalyst/skills/jade-sphere-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * Catalyst skill fragments: the four attunement-gated Deploy Jade Sphere profession
 * skills, each placing a five-second combo field, and augments with skill-owned buffs and weapon refreshes.
 */
export const CATALYST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Fire)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_FIRE]
  },
  [ID.DEPLOY_JADE_SPHERE_WATER]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Water)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_WATER]
  },
  [ID.DEPLOY_JADE_SPHERE_AIR]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Air)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_AIR]
  },
  [ID.DEPLOY_JADE_SPHERE_EARTH]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Earth)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_EARTH]
  },
  [ID.RELENTLESS_FIRE]: {
    name: 'Relentless Fire',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    // Select the authored window from live sphere state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.augment-window' } }],
    effects: [
      {
        type: 'buff',
        name: 'Base window',
        kind: 'relentless fire',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => !(catalystState.from(runtime).sphereExpiry.Fire > runtime.time)
      },
      {
        type: 'buff',
        name: 'Window with Fire sphere',
        kind: 'relentless fire',
        duration: 8,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => catalystState.from(runtime).sphereExpiry.Fire > runtime.time
      }
    ]
  },
  [ID.SHATTERING_ICE]: {
    name: 'Shattering Ice',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    // Select the authored window from live sphere state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.augment-window' } }],
    effects: [
      {
        type: 'buff',
        name: 'Base window',
        kind: 'shattering ice',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => !(catalystState.from(runtime).sphereExpiry.Water > runtime.time)
      },
      {
        type: 'buff',
        name: 'Window with Water sphere',
        kind: 'shattering ice',
        duration: 8,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => catalystState.from(runtime).sphereExpiry.Water > runtime.time
      }
    ]
  },
  [ID.ELEMENTAL_CELERITY]: {
    name: 'Elemental Celerity',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 90,
    skillFamily: 'Augment',
    // The active catalog selects reset targets; each surviving sphere gates its own authored boon.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.refresh-weapons' } }],
    effects: [
      {
        type: 'boon',
        name: 'Fire',
        boon: 'might',
        stacks: 5,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Fire > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Water',
        boon: 'vigor',
        stacks: 1,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Water > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Air',
        boon: 'fury',
        stacks: 1,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Air > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Earth',
        boon: 'protection',
        stacks: 1,
        duration: 4,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Earth > cast.effectiveEnd
      }
    ]
  }
});
