/**
 * Hammer weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 hammer position with the "Dual Orbits" family,
 * selected by the unordered pair of attunements held across its two hands;
 * every definition names its pair in `attunement`, and Weaver availability only
 * offers the skill when both of those elements are currently attuned.
 *
 * Each definition declares its two-orb grant. Shared mechanics retain lifetime
 * refresh, modifier reads, and the active-orb availability gate.
 */
import { CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * The six Dual Orbits definitions, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one per attunement pair.
 *
 * Every entry follows the same shape - an instant (0 ms) cast on an 18 s
 * cooldown, and a single 1000 ms `field-tick` packet whose 0.001 coefficient is
 * a placeholder carrier rather than meaningful strike damage. The real payload
 * is the two conditions, one contributed by each element of the pair: Fire ->
 * Burning, Water -> Vulnerability, Air -> Weakness, Earth -> Bleeding.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.DUAL_ORBITS_FIRE_AND_WATER]: {
    name: 'Dual Orbits: Fire and Water',
    description:
      'Dual Attack. Summon projectiles of fire and ice that circle around you, striking enemies they pass through. While the fire projectile is active, it grants you increased outgoing damage. While the ice projectile is active, you take reduced damage from conditions. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/0B340C7718CE9B08CBB1EEE163F10455E1F96A6C/3098871.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire+Water',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 0.75 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  [ID.DUAL_ORBITS_FIRE_AND_AIR]: {
    name: 'Dual Orbits: Fire and Air',
    description:
      'Dual Attack. Summon projectiles of fire and air that circle around you, striking enemies they pass through. While the fire projectile is active, it grants you increased outgoing damage. While the air projectile is active, your chance to critically strike is increased. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/D1C0EEFF71955A7512F57C9917077C26EC0BA2C5/3098869.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire+Air',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 0.75 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 1.5 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  [ID.DUAL_ORBITS_FIRE_AND_EARTH]: {
    name: 'Dual Orbits: Fire and Earth',
    description:
      'Dual Attack. Summon projectiles of fire and earth that circle around you, striking enemies they pass through. While the fire projectile is active, it grants you increased outgoing damage. While the earth projectile is active, you take reduced damage from strikes. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/65EA4B5877B26CF67D7CE1F1910B0A0C4C58CBC5/3098870.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Fire+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 0.75 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 2.5 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  [ID.DUAL_ORBITS_WATER_AND_AIR]: {
    name: 'Dual Orbits: Water and Air',
    description:
      'Dual Attack. Summon projectiles of ice and air that circle around you, striking enemies they pass through. While the ice projectile is active, you take reduced damage from conditions. While the air projectile is active, your chance to critically strike is increased. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/F4D9DB65E7250ED9DEB15E61EDE76A4B9D310B03/3098872.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Air+Water',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 1.5 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  [ID.DUAL_ORBITS_WATER_AND_EARTH]: {
    name: 'Dual Orbits: Water and Earth',
    description:
      'Dual Attack. Summon projectiles of ice and earth that circle around you, striking enemies they pass through. While the ice projectile is active, you take reduced damage from conditions. While the earth projectile is active, you take reduced damage from strikes. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/22A6A8B51B3E68A076F90C2F78BFFE11E65F02A0/3098868.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Water+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 2.5 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  },
  [ID.DUAL_ORBITS_AIR_AND_EARTH]: {
    name: 'Dual Orbits: Air and Earth',
    description:
      'Dual Attack. Summon projectiles of air and earth that circle around you, striking enemies they pass through. While the air projectile is active, your chance to critically strike is increased. While the earth projectile is active, you take reduced damage from strikes. Summoning a circular projectile refreshes the duration of all other circular projectiles.',
    icon: 'https://render.guildwars2.com/file/404A01282D26575AC694B4B70651010F0AFF03B8/3098867.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.HAMMER,
    attunement: 'Air+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 1000, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.001, damageKind: 'field-tick' },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 2.5 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 1.5 }
    ]),
    // Create both authored hand elements and refresh the shared orb lifetime.
    orbDuration: 15,
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.create-hammer-orbs' } }]
  }
});
