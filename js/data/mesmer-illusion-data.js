/**
 * Mesmer illusion data: weapon coefficients, clone/ambush/phantasm attacks, and timings.
 * - WEAPON_STRENGTH: Base damage multiplier by weapon type (lower = weaker).
 * - CLONE_ATTACKS: Auto-attack pattern (interval, coefficient, conditions per weapon).
 * - AMBUSH_ATTACKS: Mirage weapon-skill replacements granted by Mirage Cloak.
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
    weaponStrength: 28.5,
    sequence: [
      {
        name: "Clone: Lacerating Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.51,
        conditions: [{ name: "Bleeding", duration: 2, stacks: 1 }],
      },
      {
        name: "Clone: Ethereal Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.61,
        conditions: [{ name: "Torment", duration: 2, stacks: 1 }],
      },
      {
        name: "Clone: Mirror Strikes",
        coefficient: 1.1,
        hits: 2,
        interval: 1.17,
        conditions: [
          { name: "Bleeding", duration: 6, stacks: 1 },
          { name: "Torment", duration: 6, stacks: 1 },
        ],
      },
    ],
  },
  Dagger: {
    name: "Clone: Flying Cutter",
    coefficient: 0.7,
    hits: 1,
    interval: 0.68,
    weaponStrength: 26.5,
  },
  Greatsword: {
    coefficient: 1.1,
    hits: 3,
    interval: 1.5,
    weaponStrength: 26.5,
  },
  Rifle: { coefficient: 0.5, hits: 1, interval: 1.2, weaponStrength: 26.5 },
  Scepter: {
    name: "Clone: Ether Bolt",
    coefficient: 0.3,
    hits: 1,
    interval: 2,
    weaponStrength: 34,
    conditions: [{ name: "Torment", duration: 4, stacks: 1 }],
  },
  Spear: {
    weaponStrength: 26.3,
    sequence: [
      {
        name: "Clone: Psycut",
        coefficient: 1,
        hits: 1,
        interval: 0.93,
      },
      {
        name: "Clone: Psystrike",
        coefficient: 1,
        hits: 1,
        interval: 0.5,
      },
      {
        name: "Clone: Mind Pierce",
        coefficient: 1.5,
        hits: 1,
        interval: 0.75,
      },
    ],
  },
  Staff: {
    name: "Clone: Winds of Chaos",
    coefficient: 0.49,
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
    weaponStrength: 20.5,
    firstAttackDelay: 2.48,
    sequence: [
      {
        name: "Clone: Mind Slash",
        coefficient: 0.75,
        hits: 1,
        interval: 2.48 / 3,
      },
      {
        name: "Clone: Mind Gash",
        coefficient: 0.75,
        hits: 1,
        interval: 2.48 / 3,
      },
      {
        name: "Clone: Mind Stab",
        coefficient: 0.12,
        hits: 1,
        interval: 2.48 / 3,
      },
    ],
  },
};

/**
 * Mirage Ambush attacks. Player and clone values differ for several weapons,
 * so both variants are kept explicitly. Coefficients are totals across all
 * hits, matching the scheduler's damage-group format.
 */
export const AMBUSH_ATTACKS = {
  Axe: {
    id: 44321,
    name: "Imaginary Axes",
    icon:
      "https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png",
    description:
      "Ambush. Release phantasmal axes that seek out the nearest target after a short delay.",
    activation: 0.78,
    cooldown: 1,
    player: {
      coefficient: 1,
      hits: 2,
      conditions: [{ name: "Torment", duration: 3.5, stacks: 3 }],
    },
    clone: {
      coefficient: 3.7,
      hits: 2,
      activation: 1.11,
      conditions: [{ name: "Torment", duration: 4, stacks: 1 }],
    },
  },
  Dagger: {
    id: 69389,
    name: "Phantom Razor",
    icon:
      "https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png",
    description:
      "Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.",
    activation: 0.75,
    cooldown: 1,
    player: {
      coefficient: 3,
      hits: 3,
      conditions: [
        { name: "Bleeding", duration: 5, stacks: 2 },
        { name: "Torment", duration: 5, stacks: 2 },
      ],
    },
    clone: {
      coefficient: 3,
      hits: 3,
      activation: 0,
      conditions: [
        { name: "Bleeding", duration: 7, stacks: 1 },
        { name: "Torment", duration: 7, stacks: 1 },
      ],
    },
  },
  Greatsword: {
    id: 44241,
    name: "Split Surge",
    icon:
      "https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png",
    description:
      "Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.",
    activation: 1.5,
    cooldown: 0.5,
    player: { coefficient: 3.19, hits: 3 },
    clone: { coefficient: 3.1875, hits: 3 },
    playerBoons: [{ name: "Might", duration: 5, stacks: 6 }],
    vulnerability: { duration: 5, stacks: 6 },
  },
  Rifle: {
    id: 71800,
    name: "Effervescence",
    icon:
      "https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png",
    description:
      "Ambush. Spray invigorating magic, damaging enemies and healing allies.",
    activation: 0.25,
    cooldown: 1,
    player: { coefficient: 2.6, hits: 4 },
    clone: { coefficient: 1.2, hits: 4 },
    playerBoons: [{ name: "Vigor", duration: 4, stacks: 1 }],
  },
  Scepter: {
    id: 42304,
    name: "Ether Barrage",
    icon:
      "https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png",
    description:
      "Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment. Condition duration is halved for clones.",
    activation: 1.5,
    cooldown: 1,
    player: {
      coefficient: 1.25,
      hits: 5,
      conditions: [
        { name: "Confusion", duration: 4, stacks: 2 },
        { name: "Torment", duration: 4, stacks: 3 },
      ],
    },
    clone: {
      coefficient: 3.75,
      hits: 5,
      conditions: [
        { name: "Confusion", duration: 2, stacks: 2 },
        { name: "Torment", duration: 2, stacks: 3 },
      ],
    },
  },
  Spear: {
    id: 73067,
    name: "Fractured Glass",
    icon:
      "https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png",
    description:
      "Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.",
    activation: 1,
    cooldown: 1,
    player: { coefficient: 3.15, hits: 7 },
    clone: { coefficient: 3.15, hits: 7 },
    vulnerability: { duration: 6, stacks: 7 },
  },
  Staff: {
    id: 40184,
    name: "Chaos Vortex",
    icon:
      "https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png",
    description:
      "Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.",
    activation: 1,
    cooldown: 1,
    player: {
      coefficient: 0.6,
      hits: 1,
      conditions: [
        { name: "Bleeding", duration: 10, stacks: 1 },
        { name: "Torment", duration: 10, stacks: 1 },
        { name: "Confusion", duration: 10, stacks: 1 },
      ],
    },
    clone: {
      coefficient: 1.12,
      hits: 1,
      conditions: [
        { name: "Bleeding", duration: 4, stacks: 1 },
        { name: "Torment", duration: 4, stacks: 1 },
        { name: "Confusion", duration: 3, stacks: 1 },
      ],
    },
    playerBoons: [
      { name: "Might", duration: 15, stacks: 2 },
      { name: "Fury", duration: 2, stacks: 1 },
    ],
    cloneBoons: [
      { name: "Might", duration: 15, stacks: 2 },
      { name: "Fury", duration: 2, stacks: 1 },
    ],
  },
  Sword: {
    id: 45230,
    name: "Mirage Thrust",
    icon:
      "https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png",
    description:
      "Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.",
    activation: 0.75,
    cooldown: 1,
    player: { coefficient: 3, hits: 1 },
    clone: { coefficient: 3, hits: 1 },
    createsClone: true,
    control: true,
  },
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
