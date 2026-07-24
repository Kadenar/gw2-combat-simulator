/**
 * Mesmer profession mechanics: condition damage formulas, shatter types, skill classifications, instruments.
 * - CONDITION_FORMULAS: Damage per tick by condition (base + scaling per condition damage stat).
 * - SHATTERS: Shatter skills (Mind Wrack, Cry of Frustration, etc.) with slot and damage type.
 * - CONTROL_SKILLS: Skills that disable target (stun/daze/knockdown).
 * - BLIND_SKILLS: Skills that blind primary target.
 * - ARISTOCRACY_SKILLS: Skills triggering Aristocracy relic (Weakness/Vulnerability).
 * - PEITHA_SKILLS: Skills triggering Peitha relic (movement/displacement).
 * - INSTRUMENTS: Troubadour instruments (Lute, Flute, Drum, Harp) with damage/conditions.
 * - MECHANIC_SKILLS: Profession-specific mechanic skills (Shatters, Instruments, Signets).
 */

/** Condition tick damage formula: base + (condition damage × scaling factor). */
export const CONDITION_FORMULAS = {
  Bleeding: { base: 22, scaling: 0.06 },
  Burning: { base: 131, scaling: 0.155 },
  Confusion: {
    base: 18.25,
    scaling: 0.05,
    activationBase: 16.24,
    activationScaling: 0.0325,
  },
  Poisoned: { base: 33.5, scaling: 0.06 },
  Torment: {
    base: 22,
    scaling: 0.06,
    stationaryBase: 31.8,
    stationaryScaling: 0.09,
  },
};

export const TRAIT_DAMAGE = Object.freeze({
  "Lesser Chaos Storm": {
    coefficient: 1.98,
    hits: 6,
    cooldown: 28,
  },
  "Phantasmal Blade": {
    coefficient: 0.7,
    hits: 1,
    weaponStrength: 2553.5,
  },
  Syncopate: {
    coefficient: 0.75,
    hits: 1,
  },
  "Time Bomb": {
    coefficient: 3,
    hits: 1,
    duration: 5,
    damageIncrease: 0.1,
  },
});

export const SHATTERS = {
  "Mind Wrack": {
    slot: 1,
    kind: "core-power",
    coefficients: [0.81, 1.61, 2.42, 3.22],
  },
  "Cry of Frustration": {
    slot: 2,
    kind: "core-confusion",
    coefficients: [0.42, 0.84, 1.25, 1.67],
  },
  Diversion: { slot: 3, kind: "control", coefficients: [0, 0, 0, 0] },
  Distortion: { slot: 4, kind: "defense", coefficients: [0, 0, 0, 0] },
  "Split Second": {
    slot: 1,
    kind: "chrono-power",
    coefficients: [1.61, 3.22, 3.86, 4.51],
  },
  Rewinder: {
    slot: 2,
    kind: "chrono-confusion",
    coefficients: [0.42, 0.84, 1.25, 1.67],
  },
  "Time Sink": { slot: 3, kind: "control", coefficients: [0, 0, 0, 0] },
  "Bladesong Harmony": {
    slot: 1,
    kind: "blade-power",
    coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
  },
  "Bladesong Sorrow": {
    slot: 2,
    kind: "blade-confusion",
    coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
  },
  "Bladesong Dissonance": {
    slot: 3,
    kind: "blade-control",
    coefficients: [0, 1, 1, 1, 1, 1],
  },
  "Bladesong Distortion": {
    slot: 4,
    kind: "blade-defense",
    coefficients: [0, 0, 0, 0, 0, 0],
  },
  "Bladeturn Requiem": {
    slot: 5,
    kind: "blade-requiem",
    coefficients: [0, 0.3, 0.6, 0.9, 1.2, 1.5],
  },
  "Continuum Split": {
    slot: 5,
    kind: "continuum",
    coefficients: [0, 0, 0, 0],
  },
};

// Skills whose modeled hit disables the benchmark target. Keep this explicit:
// descriptions also mention incoming disables and conditional defiance damage,
// neither of which should activate Relic of the Claw.
export const CONTROL_SKILLS = new Set([
  "Chaos Storm",
  "Illusionary Wave",
  "Magic Bullet",
  "Signet of Domination",
  "Vortex",
  "Illusion of Drowning",
  "Phantasmal Defender",
  "Signet of Humility",
  "Tides of Time",
  "Gravity Well",
  "Mirage Advance",
  "Phantasmal Sharpshooter",
  "Flustering Flute",
  "Deafening Drum",
  "Diversion",
  "Time Sink",
  "Bladesong Dissonance",
  "Into the Void",
  "Counter Blade",
  "Mirage Thrust",
]);

// These skills blind the primary benchmark target directly. Magic Bullet is
// excluded because its blind applies only to the third target in the bounce.
export const BLIND_SKILLS = new Set([
  "Counterspell",
  "Signet of Midnight",
  "Blinding Tide",
  "The Prestige",
  "Chaos Armor",
  "Mirage Advance",
]);

export const ARISTOCRACY_SKILLS = new Set([
  "Mind Slash",
  "Mind Gash",
  "Mind Pierce",
  "Blinding Tide",
  "Rain of Swords",
]);

export const PEITHA_SKILLS = new Set([
  "Blink",
  "Phase Retreat",
  "False Oasis",
  "Crystal Sands",
  "Mirage Advance",
  "Sand through Glass",
  "Illusionary Ambush",
  "Jaunt",
  "Axes of Symmetry",
]);

export const INSTRUMENTS = {
  "Lively Lute": {
    instrument: "Lute",
    coefficient: 3,
    hits: 3,
  },
  "Flustering Flute": {
    instrument: "Flute",
    coefficient: 1,
    hits: 1,
    conditions: [{ name: "Confusion", duration: 4, stacks: 3 }],
  },
  "Deafening Drum": {
    instrument: "Drum",
    coefficient: 2,
    hits: 1,
  },
  "Harmonious Harp": {
    instrument: "Harp",
    coefficient: 0,
    hits: 0,
  },
};

export const MECHANIC_SKILLS = {
  Core: ["Mind Wrack", "Cry of Frustration", "Diversion", "Distortion"],
  Chronomancer: [
    "Split Second",
    "Rewinder",
    "Time Sink",
    "Distortion",
    "Continuum Split",
  ],
  Mirage: ["Mind Wrack", "Cry of Frustration", "Diversion", "Distortion"],
  Virtuoso: [
    "Bladesong Harmony",
    "Bladesong Sorrow",
    "Bladesong Dissonance",
    "Bladesong Distortion",
    "Bladeturn Requiem",
  ],
  Troubadour: [
    "Lively Lute",
    "Flustering Flute",
    "Deafening Drum",
    "Harmonious Harp",
    "Crescendo",
  ],
};
