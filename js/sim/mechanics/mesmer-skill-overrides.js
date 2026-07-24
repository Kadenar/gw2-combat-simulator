/**
 * Hand-authored additions and corrections layered over the generated skill catalog.
 * Includes measured timings, corrected coefficients, autoattack chain steps,
 * flip/ambush skills, and simulator-only actions.
 */

import { AMBUSH_ATTACKS } from "../../data/mesmer-illusion-data.js";
import { INSTRUMENTS, SHATTERS } from "../../data/mesmer-profession-data.js";

/**
 * Weapon autoattack chains: progression of skills per weapon type.
 * Each chain has 2-3 skills; can be resumed after casting a different skill (except gap-breakers).
 */
export const AUTOATTACK_CHAINS = Object.freeze({
  "Mind Slash": ["Mind Slash", "Mind Gash", "Mind Spike"],
  "Ether Bolt": ["Ether Bolt", "Ether Blast", "Ether Clone"],
  "Lacerating Chop": [
    "Lacerating Chop",
    "Ethereal Chop",
    "Mirror Strikes",
  ],
  Psycut: ["Psycut", "Psystrike", "Mind Pierce"],
});

const autoattackChainPositions = new Map(
  Object.entries(AUTOATTACK_CHAINS).flatMap(([root, names]) =>
    names.map((name, index) => [name, { root, step: index + 1 }]),
  ),
);

const autoattackChainSkill = ({
  id,
  name,
  description,
  icon,
  weapon,
  activation,
  coefficient,
  hits = 1,
  conditions = [],
  specialization = "",
  resource = null,
  ...extra
}) => ({
  id,
  name,
  description,
  icon,
  type: "Weapon",
  weapon,
  slot: "Weapon_1",
  specialization,
  environment: "Terrestrial",
  activation,
  cooldown: 0,
  damage: [
    {
      coefficient,
      hits,
      label: "Damage",
      source: "Player",
      weapon: weapon.toLowerCase(),
    },
  ],
  conditions,
  phantasm: false,
  resource,
  blade: false,
  wikiUrl: `https://wiki.guildwars2.com/wiki/${name.replaceAll(" ", "_")}`,
  ...extra,
});

export const AUTOATTACK_CHAIN_SKILLS = [
  autoattackChainSkill({
    id: 10171,
    name: "Mind Gash",
    description: "Chain. Gash your foe to make them vulnerable.",
    icon:
      "https://render.guildwars2.com/file/CFFAD1180816A86DC03156B431A0B22C703FEAE4/103189.png",
    weapon: "Sword",
    activation: 0.78,
    coefficient: 1,
    chainRoot: "Mind Slash",
    chainStep: 2,
  }),
  autoattackChainSkill({
    id: 10172,
    name: "Mind Spike",
    description:
      "Stab your foe and rip a boon. Deals additional damage to boonless targets.",
    icon:
      "https://render.guildwars2.com/file/4C1A68BFFDD61A4147BD41039BB82D0D4F4E766B/103190.png",
    weapon: "Sword",
    activation: 1.26,
    coefficient: 1.5,
    boonlessCoefficient: 2,
    chainRoot: "Mind Slash",
    chainStep: 3,
  }),
  autoattackChainSkill({
    id: 10290,
    name: "Ether Blast",
    description: "Chain. Shoot a second bolt of energy at your target.",
    icon:
      "https://render.guildwars2.com/file/09C73FBE6CFA6AEFEF9A440AC162F2F5E8227867/103557.png",
    weapon: "Scepter",
    activation: 0.78,
    coefficient: 0.5,
    conditions: [{ name: "Torment", duration: 6, stacks: 1 }],
    chainRoot: "Ether Bolt",
    chainStep: 2,
  }),
  autoattackChainSkill({
    id: 10291,
    name: "Ether Clone",
    description:
      "Damage your target and summon a clone. Inflict torment instead at the clone limit.",
    icon:
      "https://render.guildwars2.com/file/66D5114144D3A271C72F48A124CCB70E040F3EE6/103771.png",
    weapon: "Scepter",
    activation: 1.26,
    coefficient: 0.75,
    resource: { mode: "add", count: 1 },
    maxCloneConditions: [{ name: "Torment", duration: 9, stacks: 1 }],
    chainRoot: "Ether Bolt",
    chainStep: 3,
  }),
  autoattackChainSkill({
    id: 44840,
    name: "Ethereal Chop",
    description: "Inflict torment on your target.",
    icon:
      "https://render.guildwars2.com/file/257AE20DBC1F5BB232D8F37FED4443065ED10346/1770501.png",
    weapon: "Axe",
    activation: 0.795,
    coefficient: 0.55,
    conditions: [{ name: "Torment", duration: 2, stacks: 1 }],
    specialization: "Mirage",
    chainRoot: "Lacerating Chop",
    chainStep: 2,
  }),
  autoattackChainSkill({
    id: 41164,
    name: "Mirror Strikes",
    description: "Inflict bleeding and torment on your target.",
    icon:
      "https://render.guildwars2.com/file/44E70008A846C1A03343996F1F10031966E41F0D/1770502.png",
    weapon: "Axe",
    activation: 1.08,
    coefficient: 1.1,
    hits: 2,
    conditions: [
      { name: "Bleeding", duration: 6, stacks: 1 },
      { name: "Torment", duration: 6, stacks: 1 },
    ],
    specialization: "Mirage",
    chainRoot: "Lacerating Chop",
    chainStep: 3,
  }),
  autoattackChainSkill({
    id: 73066,
    name: "Psystrike",
    description: "Rend your foe with an upward swing. Gain might per target struck.",
    icon:
      "https://render.guildwars2.com/file/0CBE4BCB69A5B2200980B4DC98BC0E6AC25675FC/3379153.png",
    weapon: "Spear",
    activation: 0.5,
    coefficient: 1,
    chainRoot: "Psycut",
    chainStep: 2,
  }),
  autoattackChainSkill({
    id: 73095,
    name: "Mind Pierce",
    description:
      "Deliver a finishing thrust, breaking your opponent's mind and inflicting weakness.",
    icon:
      "https://render.guildwars2.com/file/3C543ADB3D7EF49DE574040241F1B206B20CB7A0/3379154.png",
    weapon: "Spear",
    activation: 0.75,
    coefficient: 1.5,
    chainRoot: "Psycut",
    chainStep: 3,
  }),
];

const flipSkill = ({
  id,
  name,
  description,
  icon,
  weapon,
  slot,
  activation = 0,
  damage = [],
  conditions = [],
  resource = null,
  flipParent,
  flipDuration,
  flipDelay = 0,
  ...extra
}) => ({
  id,
  name,
  description,
  icon,
  type: "Weapon",
  weapon,
  slot,
  specialization: "",
  environment: "Terrestrial",
  activation,
  cooldown: 0,
  damage,
  conditions,
  phantasm: false,
  resource,
  blade: false,
  flipParent,
  flipDuration,
  flipDelay,
  wikiUrl: `https://wiki.guildwars2.com/wiki/${name.replaceAll(" ", "_")}`,
  ...extra,
});

export const FLIP_SKILLS = [
  flipSkill({
    id: 71792,
    name: "Dimensional Aperture",
    description:
      "Collapse your singularity into a single-use portal and increase Singularity Shot's recharge by 50%.",
    icon:
      "https://render.guildwars2.com/file/4342CE56CCFF5669FE084891F377B95D1026AFA1/3256364.png",
    weapon: "Rifle",
    slot: "Weapon_5",
    flipParent: "Singularity Shot",
    flipDuration: 3,
    parentCooldownIncrease: 0.5,
  }),
  flipSkill({
    id: 72076,
    name: "Abstraction",
    description:
      "Detonate your beacon, damaging and debilitating enemies while bolstering allies.",
    icon:
      "https://render.guildwars2.com/file/72E5ACDEAE7571B67F96F9BDA8A271CCCF08957B/3256361.png",
    weapon: "Rifle",
    slot: "Weapon_3",
    damage: [
      {
        coefficient: 1.81,
        hits: 1,
        label: "PvE detonation",
        source: "Player",
        weapon: "rifle",
      },
    ],
    flipParent: "Inspiring Imagery",
    flipDuration: 2,
  }),
  flipSkill({
    id: 10363,
    name: "Into the Void",
    description:
      "Shatter your Temporal Curtain, pulling nearby enemies toward its position.",
    icon:
      "https://render.guildwars2.com/file/E4D0E740C1700E3ACFBBD25D7F0C0628E0204559/103758.png",
    weapon: "Focus",
    slot: "Weapon_4",
    flipParent: "Temporal Curtain",
    flipDuration: 5,
    flipDelay: 1,
  }),
  flipSkill({
    id: 10358,
    name: "Counter Blade",
    description: "Shoot a bolt that damages and dazes foes in a line.",
    icon:
      "https://render.guildwars2.com/file/7ADC0ABCDBA004A5DE085096300DA2B9C191C84C/103792.png",
    weapon: "Sword",
    slot: "Weapon_4",
    activation: 1.02,
    damage: [
      {
        coefficient: 0.1,
        hits: 1,
        label: "Damage",
        source: "Player",
        weapon: "sword",
      },
    ],
    flipParent: "Illusionary Riposte",
    flipDuration: 3,
  }),
  flipSkill({
    id: 10337,
    name: "Swap",
    description:
      "Swap places with your clone and immobilize nearby foes.",
    icon:
      "https://render.guildwars2.com/file/BEDBA7E72F06AA51D124B9B29EA53D4E3FEAFA48/103728.png",
    weapon: "Sword",
    slot: "Weapon_3",
    flipParent: "Illusionary Leap",
    flipDuration: 5,
  }),
];

export const AMBUSH_SKILLS = Object.entries(AMBUSH_ATTACKS).map(
  ([weapon, ambush]) => ({
    id: ambush.id,
    name: ambush.name,
    description: ambush.description,
    icon: ambush.icon,
    type: "Weapon",
    weapon,
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    activation: ambush.activation,
    cooldown: ambush.cooldown,
    damage: [],
    conditions: [],
    phantasm: false,
    resource: null,
    blade: false,
    ambush: true,
    wikiUrl:
      `https://wiki.guildwars2.com/wiki/${ambush.name.replaceAll(" ", "_")}`,
  }),
);

export const PSEUDO_SKILLS = [
  {
    id: 10314,
    name: "Counterspell",
    description:
      "Flip skill for Illusionary Counter. Fire a blinding bolt, inflict confusion, and summon one clone on hit.",
    icon:
      "https://render.guildwars2.com/file/33B7ADCA30B5EF4C1B52F71F39596FDEE9ECD8EB/103776.png",
    type: "Weapon",
    weapon: "Scepter",
    slot: "Weapon_2",
    environment: "Terrestrial",
    activation: 0.9,
    cooldown: 0,
    damage: [
      {
        coefficient: 0.1,
        hits: 1,
        label: "Projectile",
        source: "Player",
        weapon: "scepter",
      },
    ],
    conditions: [{ name: "Confusion", duration: 7, stacks: 5 }],
    resource: { mode: "add", count: 1 },
    blade: false,
    flipParent: "Illusionary Counter",
    flipDuration: 2,
    wikiUrl: "https://wiki.guildwars2.com/wiki/Counterspell",
  },
  {
    // Ammo-based flip of Mantra of Pain. Unlike the time-window flips above,
    // Power Spike is armed from the opening (mantras are pre-channeled on the
    // bench) with two charges, recharges one charge every 10 seconds while any
    // charge remains, and reverts to Mantra of Pain once both are spent — the
    // mantra must be re-channeled to refill it.
    id: 10212,
    name: "Power Spike",
    description:
      "Mantra. Damage your target. Opens the bench with two charges and reverts to Mantra of Pain once both are spent.",
    icon:
      "https://render.guildwars2.com/file/3519C5C770CCEAF92926D9495999E1F8A23D5AF3/103743.png",
    type: "Utility",
    weapon: "",
    slot: "Utility",
    specialization: "",
    environment: "Terrestrial",
    activation: 0,
    cooldown: 10,
    damage: [
      { coefficient: 1.33, hits: 1, label: "Damage", source: "Player" },
    ],
    conditions: [],
    resource: null,
    blade: false,
    flipParent: "Mantra of Pain",
    ammo: 2,
    armedAtStart: true,
    wikiUrl: "https://wiki.guildwars2.com/wiki/Power_Spike",
  },
  ...AUTOATTACK_CHAIN_SKILLS,
  ...FLIP_SKILLS,
  {
    id: -1,
    name: "Dodge / Mirage Cloak",
    description:
      "Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.",
    icon: "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    type: "Action",
    slot: "Action",
    activation: 0,
    cooldown: 10,
    ammo: 2,
  },
  {
    id: -3,
    name: "Swap Weapons",
    description: "Swap between weapon sets. The swap has a 10-second recharge.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    activation: 0,
    cooldown: 10,
  },
  {
    id: -4,
    name: "Continuum Shift",
    description:
      "End Continuum Split early and restore the cooldown state captured when the split began.",
    icon: "https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png",
    type: "Action",
    slot: "Action",
    activation: 0,
    cooldown: 0,
    specialization: "Chronomancer",
  },
];

const choiceOverrides = {
  "Winds of Chaos": {
    // Measured at 760 ms with Quickness; store the unmodified cast time
    // because the scheduler applies Quickness separately.
    activation: 1.14,
  },
  "Phantasmal Warlock": {
    activation: 1.17,
    damage: [
      {
        coefficient: 0.925,
        hits: 3,
        label: "One warlock",
        source: "Phantasm",
        weapon: "staff",
      },
    ],
    conditions: [{ name: "Torment", duration: 4, stacks: 6 }],
  },
  "Phantasmal Duelist": {
    activation: 0.81,
    damage: [
      { coefficient: 0.33, hits: 3, label: "Damage", source: "Player", weapon: "pistol" },
      { coefficient: 0.92, hits: 8, label: "Illusion Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  },
  "Magic Bullet": {
    // Measured at 440 ms with Quickness.
    activation: 0.66,
  },
  "Confusing Images": {
    // Measured at 1850 ms with Quickness.
    activation: 2.775,
    pulseCount: 7,
  },
  "Gravity Well": {
    damage: [
      {
        coefficient: 3.3,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
      {
        coefficient: 2.1,
        hits: 1,
        label: "Final damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Ether Bolt": {
    // Measured at 440 ms with Quickness.
    activation: 0.66,
  },
  "Mind Slash": {
    // Measured at 360 ms with Quickness.
    activation: 0.54,
  },
  "Lacerating Chop": {
    // Measured at 430 ms with Quickness.
    activation: 0.645,
    conditions: [{ name: "Bleeding", duration: 2, stacks: 1 }],
  },
  "Lingering Thoughts": {
    // Measured at 930 ms with Quickness.
    activation: 1.395,
  },
  "Axes of Symmetry": {
    // Measured at 1020 ms with Quickness.
    activation: 1.53,
  },
  "Mind Stab": {
    // Measured at 360 ms with Quickness.
    activation: 0.54,
  },
  "Mind the Gap": {
    damage: [
      {
        coefficient: 1.92,
        hits: 1,
        label: "Outer-edge damage",
        source: "Player",
        weapon: "spear",
      },
    ],
  },
  Psycut: {
    // Psystrike and Mind Pierce now own the rest of the 2.18-second chain.
    activation: 0.93,
  },
  "Illusionary Counter": {
    // Damage, torment, and the two clones require a successful block.
    // Activating or manually ending the block against an idle target does not
    // trigger any of them; Counterspell owns the manual flip's effects.
    damage: [],
    conditions: [],
    resource: null,
    defaultInterruptMs: 120,
  },
  "Signet of the Ether": {
    // The active heals and resets phantasm cooldowns. Its passive reacts to
    // illusion summons; it does not summon an illusion itself.
    resource: null,
    // Measured at 920 ms with Quickness.
    activation: 1.38,
  },
  "Spatial Surge": {
    damage: [
      {
        coefficient: 1.1,
        hits: 3,
        label: "Maximum-range damage",
        source: "Player",
      },
    ],
  },
  "Mirror Blade": {
    damage: [
      {
        coefficient: 2.5,
        hits: 1,
        label: "Maximum single-target damage",
        source: "Player",
      },
    ],
  },
  "Phantasmal Disenchanter": {
    activation: 1.14,
    damage: [
      {
        coefficient: 2.05,
        hits: 1,
        label: "Target without boons",
        source: "Phantasm",
        weapon: "utility",
      },
    ],
  },
  "Phantasmal Lancer": {
    // The API currently omits the phantasm flag and clone conversion data.
    phantasm: true,
    resource: { mode: "phantasm", count: 1 },
    damage: [
      {
        coefficient: 1,
        hits: 1,
        label: "Mesmer attack",
        source: "Player",
        weapon: "spear",
      },
      {
        coefficient: 1.23,
        hits: 1,
        label: "One lancer",
        source: "Phantasm",
        weapon: "spear",
      },
    ],
  },
  "Phantasmal Swordsman": {
    activation: 1.29,
    damage: [
      {
        coefficient: 0.5,
        hits: 1,
        label: "Mesmer strike",
        source: "Player",
        weapon: "sword",
      },
      {
        coefficient: 1.03,
        hits: 1,
        label: "Phantasm leap",
        source: "Phantasm",
        weapon: "sword",
      },
      {
        coefficient: 3.28,
        hits: 8,
        label: "Phantasm Blurred Frenzy",
        source: "Phantasm",
        weapon: "sword",
      },
    ],
  },
  "Phantasmal Mage": {
    activation: 1.2,
    damage: [
      {
        coefficient: 0.19,
        hits: 1,
        label: "Mesmer attack",
        source: "Player",
        weapon: "torch",
      },
      {
        coefficient: 0.5,
        hits: 1,
        label: "Phantasm attack",
        source: "Phantasm",
        weapon: "torch",
      },
    ],
  },
  "Phantasmal Sharpshooter": {
    damage: [
      {
        coefficient: 2.28,
        hits: 1,
        label: "Phantasm shot",
        source: "Phantasm",
        weapon: "rifle",
      },
    ],
  },
  "Blurred Frenzy": {
    damage: [
      {
        coefficient: 3.6,
        hits: 8,
        label: "Damage",
        source: "Player",
        weapon: "sword",
      },
    ],
  },
  "Rain of Swords": {
    damage: [
      {
        coefficient: 6,
        hits: 5,
        label: "Damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Tale of the Tortured Mastermind": {
    damage: [
      {
        coefficient: 4,
        hits: 4,
        label: "Damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Well of Action": {
    damage: [
      {
        coefficient: 4.5,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Well of Calamity": {
    damage: [
      {
        coefficient: 3.9,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
      {
        coefficient: 2.1,
        hits: 1,
        label: "Final damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Well of Senility": {
    damage: [
      {
        coefficient: 4.5,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  },
  "Phantasmal Berserker": {
    activation: 0.84,
    damage: [
      {
        coefficient: 2.46,
        hits: 4,
        label: "One berserker",
        source: "Phantasm",
        weapon: "greatsword",
      },
      {
        coefficient: 1.2,
        hits: 1,
        label: "Greatsword damage",
        source: "Player",
        weapon: "greatsword",
      },
    ],
  },
  "Phantasmal Warden": {
    activation: 0.69,
    damage: [
      { coefficient: 1.656, hits: 12, label: "Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  },
  "Phantasmal Defender": {
    activation: 1.155,
    damage: [
      { coefficient: 0.4, hits: 1, label: "Damage", source: "Phantasm", weapon: "phantasm defender" },
    ],
  },
  "Echo of Memory": {
    activation: 2.46,
    damage: [
      { coefficient: 0.9, hits: 1, label: "Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  },
  "Chaos Storm": {
    // Measured at 480 ms with Quickness.
    activation: 0.72,
    damage: [
      {
        coefficient: 1.98,
        hits: 6,
        label: "Six pulses",
        source: "Player",
      },
    ],
    // Each pulse applies one random condition (Poison/Chill/Weakness).
    // Only Poison deals condition damage; expected value is 6 × (1/3) = 2 stacks.
    conditions: [{ name: "Poisoned", duration: 4, stacks: 2 }],
  },
  "Flying Cutter": {
    damage: [
      {
        coefficient: 0.5,
        hits: 1,
        label: "Projectile",
        source: "Player",
      },
    ],
    trackedHitDamage: {
      hitsRequired: 3,
      duration: 5,
      damage: {
        coefficient: 0.6,
        hits: 3,
        label: "Cutter Burst",
        source: "Player",
      },
    },
  },
  "Unstable Bladestorm": {
    damage: [
      {
        coefficient: 1,
        hits: 4,
        label: "Storm pulses",
        source: "Player",
      },
      {
        coefficient: 2,
        hits: 4,
        label: "Launched blades",
        source: "Player",
      },
    ],
  },
  Bladecall: {
    activation: 0.66,
    damage: [
      {
        coefficient: 0.75,
        hits: 3,
        label: "Outgoing damage",
        source: "Player",
        weapon: "dagger",
      },
      {
        coefficient: 0.75,
        hits: 3,
        label: "Returning damage",
        source: "Player",
        weapon: "dagger",
      },
    ],
  },
  Abstraction: {
    damage: [
      {
        coefficient: 2.5,
        hits: 1,
        label: "Detonation",
        source: "Player",
        weapon: "rifle",
      },
    ],
  },
};

const handledByEngine = new Set([
  ...Object.keys(SHATTERS),
  ...Object.keys(INSTRUMENTS),
  "Crescendo",
]);

export const skillOverride = (name) => choiceOverrides[name] || {};

export const autoattackChainPosition = (name) =>
  autoattackChainPositions.get(name);

export const isEngineHandledSkill = (name) => handledByEngine.has(name);
