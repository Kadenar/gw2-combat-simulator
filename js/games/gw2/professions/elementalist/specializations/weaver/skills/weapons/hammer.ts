/**
 * Hammer weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 hammer position with the "Dual Orbits" family,
 * selected by the unordered pair of attunements held across its two hands;
 * every fragment names its pair in `attunement`, and Weaver availability only
 * offers the skill when both of those elements are currently attuned.
 *
 * Each definition declares its two-orb grant. Shared mechanics retain lifetime
 * refresh, modifier reads, and the active-orb availability gate.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * The six Dual Orbits fragments, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one per attunement pair.
 *
 * Every entry follows the same shape - an instant (0 ms) cast on an 18 s
 * cooldown, and a single 1000 ms `field-tick` packet whose 0.001 coefficient is
 * a placeholder carrier rather than meaningful strike damage. The real payload
 * is the two conditions, one contributed by each element of the pair: Fire ->
 * Burning, Water -> Vulnerability, Air -> Weakness, Earth -> Bleeding.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DUAL_ORBITS_FIRE_AND_WATER]: {
    name: 'Dual Orbits: Fire and Water',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 0.75, metadata: {} },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.DUAL_ORBITS_FIRE_AND_AIR]: {
    name: 'Dual Orbits: Fire and Air',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 0.75, metadata: {} },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 1.5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.DUAL_ORBITS_FIRE_AND_EARTH]: {
    name: 'Dual Orbits: Fire and Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 0.75, metadata: {} },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2.5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.DUAL_ORBITS_WATER_AND_AIR]: {
    name: 'Dual Orbits: Water and Air',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6, metadata: {} },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 1.5, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.DUAL_ORBITS_WATER_AND_EARTH]: {
    name: 'Dual Orbits: Water and Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2.5, metadata: {} },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.DUAL_ORBITS_AIR_AND_EARTH]: {
    name: 'Dual Orbits: Air and Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Create both authored hand elements and refresh the shared orb lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }],
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2.5, metadata: {} },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 1.5, metadata: {} }
    ]),
    specialization: 'Weaver'
  }
});
