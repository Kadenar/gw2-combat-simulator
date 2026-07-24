/**
 * Mesmer illusion mechanics: weapon coefficients, clone/ambush/phantasm attack data, timings.
 * - WEAPON_STRENGTH: Base damage multiplier by weapon type (lower = weaker).
 * - CLONE_ATTACKS: Auto-attack pattern (interval, coefficient, conditions per weapon).
 * - AMBUSH_ATTACKS: Mirage dodge attack (Mirage Cloak, Infinite Horizon).
 * - PHANTASM_ATTACK_TIMINGS: Phantasm cast + damage + spawn times (measured from skill start).
 * - PHANTASM_NAME_BY_SKILL: Maps summoning skills to phantasm names.
 */

/** Base damage multiplier per weapon type. Determines strike damage output with fixed stats. */
export const WEAPON_STRENGTH = {
  Axe: 1000,
  Dagger: 1000,
  Focus: 900,
  Greatsword: 1100,
  Pistol: 1000,
  Rifle: 1150,
  Scepter: 1000,
  Shield: 900,
  Spear: 1000,
  Staff: 1100,
  Sword: 1000,
  Torch: 900,
  Trident: 1000,
  Utility: 1000,
  Unequipped: 690.5,
  "Phantasm high": 2889.5,
  "Phantasm medium": 2615.5,
  "Phantasm mariner": 2556.0,
  "Phantasm defender": 2362.5,
};

/**
 * Clone auto-attack patterns by weapon: coefficient, hits, interval (seconds), weaponStrength, conditions.
 * Interval: time between successive attacks. Conditions applied on each attack.
 */
export const CLONE_ATTACKS = {
  Axe: {
    coefficient: 2.2,
    hits: 4,
    interval: 2.25,
    weaponStrength: 28.5,
    conditions: [
      { name: "Bleeding", duration: 2, stacks: 1 },
      { name: "Torment", duration: 2, stacks: 1 },
      { name: "Bleeding", duration: 6, stacks: 1 },
      { name: "Torment", duration: 6, stacks: 1 },
    ],
  },
  Dagger: { coefficient: 0.5, hits: 1, interval: 0.68, weaponStrength: 26.5 },
  Greatsword: {
    coefficient: 1.1,
    hits: 3,
    interval: 1.5,
    weaponStrength: 26.5,
  },
  Rifle: { coefficient: 0.5, hits: 1, interval: 1.2, weaponStrength: 26.5 },
  Scepter: {
    coefficient: 0.5,
    hits: 1,
    interval: 2,
    weaponStrength: 34,
    conditions: [{ name: "Torment", duration: 4, stacks: 1 }],
  },
  Spear: { coefficient: 3.5, hits: 3, interval: 2.18, weaponStrength: 26.3 },
  Staff: {
    coefficient: 0.3,
    // A completed clone cast bounces through the target twice. The conditions
    // apply once per cast, while both bounces can strike and critically hit.
    hits: 2,
    firstAttackDelay: 1.12,
    interval: 2.24,
    weaponStrength: 26,
    conditions: [
      { name: "Torment", duration: 2, stacks: 1 },
      { name: "Confusion", duration: 2, stacks: 1 },
    ],
  },
  Sword: {
    coefficient: 4,
    hits: 3,
    interval: 2.48,
    weaponStrength: 20.5,
  },
};

/**
 * Mirage Ambush attacks (dodge end): weapon-based, damage coefficient, hits, conditions.
 * Used by Mirage Cloak (player dodge) and Infinite Horizon (clone dodge).
 */
export const AMBUSH_ATTACKS = {
  Axe: {
    name: "Imaginary Axes",
    coefficient: 1.5,
    hits: 3,
    conditions: [
      { name: "Bleeding", duration: 5, stacks: 3 },
      { name: "Torment", duration: 5, stacks: 3 },
    ],
  },
  Dagger: { name: "Ambush Assault", coefficient: 1.5, hits: 3 },
  Greatsword: { name: "Split Surge", coefficient: 1.5, hits: 3 },
  Rifle: { name: "Effervescence", coefficient: 1, hits: 1 },
  Scepter: {
    name: "Ether Barrage",
    coefficient: 1.6,
    hits: 4,
    conditions: [{ name: "Confusion", duration: 4, stacks: 4 }],
  },
  Spear: { name: "Phantom Razor", coefficient: 1.8, hits: 2 },
  Staff: {
    name: "Chaos Vortex",
    coefficient: 0.8,
    hits: 2,
    conditions: [
      { name: "Bleeding", duration: 8, stacks: 2 },
      { name: "Torment", duration: 8, stacks: 2 },
    ],
  },
  Sword: { name: "Mirage Thrust", coefficient: 1.6, hits: 1 },
};

// Measured from the start of the player's cast. `damage` is when the phantasm
// has dealt all of its damage and `spawn` is when it becomes a clone. The
// Chronophantasma values include the repeated attack. Echo of Memory summons
// the phantasm named Phantasmal Avenger.
export const PHANTASM_ATTACK_TIMINGS = Object.freeze({
  "Phantasmal Avenger": {
    castTime: 1.64,
    damage: 1.44,
    spawn: 2.16,
    chronophantasmaDamage: 4.2,
    chronophantasmaSpawn: 4.96,
  },
  "Phantasmal Berserker": {
    castTime: 0.56,
    damage: 1.48,
    spawn: 2.56,
    chronophantasmaDamage: 4.68,
    chronophantasmaSpawn: 5.92,
    // Virtuoso stocks Bountiful Blades' two blades independently when each
    // Phantasmal Blade projectile arrives, rather than batching both at the
    // clone-conversion endpoint.
    virtuosoBladeHits: [3.12, 3.44],
  },
  "Phantasmal Defender": {
    castTime: 0.77,
    damage: 3.8,
    spawn: 4.51,
    chronophantasmaDamage: 8.8,
    chronophantasmaSpawn: 9.52,
  },
  "Phantasmal Disenchanter": {
    castTime: 0.76,
    damage: 1.15,
    spawn: 1.84,
    chronophantasmaDamage: 4.04,
    chronophantasmaSpawn: 4.72,
  },
  "Phantasmal Duelist": {
    castTime: 0.54,
    damage: 2.4,
    spawn: 2.88,
    chronophantasmaDamage: 6.44,
    chronophantasmaSpawn: 7.04,
  },
  "Phantasmal Mage": {
    castTime: 0.8,
    damage: 2.27,
    spawn: 2.52,
    chronophantasmaDamage: 5.32,
    chronophantasmaSpawn: 5.56,
  },
  "Phantasmal Rogue": {
    castTime: 0.61,
    damage: 1.2,
    spawn: 2,
    chronophantasmaDamage: 4.04,
    chronophantasmaSpawn: 4.76,
  },
  "Phantasmal Swordsman": {
    castTime: 0.86,
    damage: 2.48,
    spawn: 3.6,
    chronophantasmaDamage: 7.12,
    chronophantasmaSpawn: 8.27,
  },
  "Phantasmal Warden": {
    castTime: 0.46,
    damage: 5.04,
    spawn: 7.24,
    chronophantasmaDamage: 13.2,
    chronophantasmaSpawn: 15.32,
  },
  "Phantasmal Warlock": {
    castTime: 0.78,
    damage: 2.96,
    spawn: 4.24,
    chronophantasmaDamage: 8.56,
    chronophantasmaSpawn: 9.84,
  },
  // These post-table weapon phantasms retain explicit estimates.
  "Phantasmal Sharpshooter": {
    castTime: 0.5,
    damage: 1.55,
    spawn: 1.55,
    chronophantasmaDamage: 2.6,
    chronophantasmaSpawn: 2.6,
    estimated: true,
  },
  "Phantasmal Lancer": {
    castTime: 1 / 3,
    damage: 1.0833333333,
    spawn: 1.0833333333,
    chronophantasmaDamage: 1.8333333333,
    chronophantasmaSpawn: 1.8333333333,
    estimated: true,
  },
});

export const PHANTASM_NAME_BY_SKILL = Object.freeze({
  "Echo of Memory": "Phantasmal Avenger",
});
