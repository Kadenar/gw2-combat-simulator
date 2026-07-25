/**
 * Hand-authored additions and corrections layered over the generated skill catalog.
 * Includes measured timings, corrected coefficients, flip/ambush skills,
 * and simulator-only actions.
 * Defaults belong in skill-defaults.js; final composition belongs in
 * skill-mechanics.js.
 */

import { AMBUSH_ATTACKS } from "../data/mesmer-illusion-data.js";
import { MESMER_SKILL_IDS as ID } from "../data/ids.js";
import {
  implemented,
} from "../../../platform/engine/skill-factories.js";

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

const overrideDefinitions = {
  [ID.WINDS_OF_CHAOS]: implemented({
    // Measured at 760 ms with Quickness; store the unmodified cast time
    // because the scheduler applies Quickness separately.
    activation: 1.14,
  }),
  [ID.PHANTASMAL_WARLOCK]: implemented({
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
  }),
  [ID.PHANTASMAL_DUELIST]: implemented({
    activation: 0.81,
    damage: [
      { coefficient: 0.33, hits: 3, label: "Damage", source: "Player", weapon: "pistol" },
      { coefficient: 0.92, hits: 8, label: "Illusion Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  }),
  [ID.MAGIC_BULLET]: implemented({
    // Measured at 440 ms with Quickness.
    activation: 0.66,
  }),
  [ID.CONFUSING_IMAGES]: implemented({
    // Measured at 1850 ms with Quickness.
    activation: 2.775,
    pulseCount: 7,
  }),
  [ID.GRAVITY_WELL]: implemented({
    damage: [
      {
        coefficient: 3.3,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
        interval: 1,
      },
      {
        coefficient: 2.1,
        hits: 1,
        label: "Final damage",
        source: "Player",
        weapon: "utility",
        delay: 3,
      },
    ],
  }),
  [ID.ETHER_BOLT]: implemented({
    // Measured at 440 ms with Quickness.
    activation: 0.66,
  }),
  [ID.MIND_SLASH]: implemented({
    // Measured at 360 ms with Quickness.
    activation: 0.54,
  }),
  [ID.LACERATING_CHOP]: implemented({
    // Measured at 430 ms with Quickness.
    activation: 0.645,
    conditions: [{ name: "Bleeding", duration: 2, stacks: 1 }],
  }),
  [ID.LINGERING_THOUGHTS]: implemented({
    // Measured at 930 ms with Quickness.
    activation: 1.395,
  }),
  [ID.AXES_OF_SYMMETRY]: implemented({
    // Measured at 1020 ms with Quickness.
    activation: 1.53,
  }),
  [ID.MIND_STAB]: implemented({
    // Measured at 360 ms with Quickness.
    activation: 0.54,
  }),
  [ID.MIND_THE_GAP]: implemented({
    damage: [
      {
        coefficient: 1.92,
        hits: 1,
        label: "Outer-edge damage",
        source: "Player",
        weapon: "spear",
      },
    ],
  }),
  [ID.PSYCUT]: implemented({
    // Psystrike and Mind Pierce now own the rest of the 2.18-second chain.
    activation: 0.93,
  }),
  [ID.ILLUSIONARY_COUNTER]: implemented({
    // Damage, torment, and the two clones require a successful block.
    // Activating or manually ending the block against an idle target does not
    // trigger any of them; Counterspell owns the manual flip's effects.
    damage: [],
    conditions: [],
    resource: null,
    defaultInterruptMs: 120,
  }),
  [ID.SIGNET_OF_THE_ETHER]: implemented({
    // The active heals and resets phantasm cooldowns. Its passive reacts to
    // illusion summons; it does not summon an illusion itself.
    resource: null,
    // Measured at 920 ms with Quickness.
    activation: 1.38,
  }),
  [ID.SPATIAL_SURGE]: implemented({
    pulseCount: 3,
    damage: [
      {
        coefficient: 1.1,
        hits: 3,
        label: "Maximum-range damage",
        source: "Player",
      },
    ],
  }),
  [ID.MIRROR_BLADE]: implemented({
    damage: [
      {
        coefficient: 2.5,
        hits: 1,
        label: "Initial target hit",
        source: "Player",
        weapon: "greatsword",
      },
      {
        coefficient: 0.1,
        hits: 1,
        label: "Second target hit after one ally bounce",
        source: "Player",
        weapon: "greatsword",
        delay: 0.3,
      },
      {
        coefficient: 0.004,
        hits: 1,
        label: "Third target hit after two ally bounces",
        source: "Player",
        weapon: "greatsword",
        delay: 0.6,
      },
      {
        coefficient: 0.00016,
        hits: 1,
        label: "Fourth target hit after three ally bounces",
        requiredTrait: "Bountiful Blades",
        source: "Player",
        weapon: "greatsword",
        delay: 0.9,
      },
    ],
  }),
  [ID.PHANTASMAL_DISENCHANTER]: implemented({
    activation: 1.14,
    damage: [
      {
        coefficient: 1,
        hits: 1,
        label: "Target without boons",
        source: "Phantasm",
        weapon: "phantasm medium",
      },
    ],
  }),
  [ID.PHANTASMAL_LANCER]: implemented({
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
  }),
  [ID.PHANTASMAL_SWORDSMAN]: implemented({
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
        coefficient: 0.5,
        hits: 1,
        label: "Phantasm leap",
        source: "Phantasm",
        weapon: "phantasm medium",
      },
      {
        coefficient: 1.6,
        hits: 8,
        label: "Phantasm Blurred Frenzy",
        source: "Phantasm",
        weapon: "phantasm medium",
      },
    ],
  }),
  [ID.PHANTASMAL_MAGE]: implemented({
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
  }),
  [ID.PHANTASMAL_SHARPSHOOTER]: implemented({
    damage: [
      {
        coefficient: 2.28,
        hits: 1,
        label: "Phantasm shot",
        source: "Phantasm",
        weapon: "rifle",
      },
    ],
  }),
  [ID.BLURRED_FRENZY]: implemented({
    damage: [
      {
        coefficient: 3.6,
        hits: 8,
        label: "Damage",
        source: "Player",
        weapon: "sword",
      },
    ],
  }),
  [ID.RAIN_OF_SWORDS]: implemented({
    damage: [
      {
        coefficient: 6,
        hits: 5,
        label: "Damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  }),
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: implemented({
    damage: [
      {
        coefficient: 4,
        hits: 4,
        label: "Damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  }),
  [ID.WELL_OF_ACTION]: implemented({
    damage: [
      {
        coefficient: 4.5,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  }),
  [ID.WELL_OF_CALAMITY]: implemented({
    damage: [
      {
        coefficient: 3.9,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
        interval: 1,
      },
      {
        coefficient: 2.1,
        hits: 1,
        label: "Final damage",
        source: "Player",
        weapon: "utility",
        delay: 3,
      },
    ],
  }),
  [ID.WELL_OF_SENILITY]: implemented({
    damage: [
      {
        coefficient: 4.5,
        hits: 3,
        label: "Pulse damage",
        source: "Player",
        weapon: "utility",
      },
    ],
  }),
  [ID.PHANTASMAL_BERSERKER]: implemented({
    activation: 0.84,
    damage: [
      {
        coefficient: 1.2,
        hits: 4,
        label: "One berserker",
        source: "Phantasm",
        weapon: "phantasm high",
      },
      {
        coefficient: 1.2,
        hits: 1,
        label: "Greatsword damage",
        source: "Player",
        weapon: "greatsword",
      },
    ],
  }),
  [ID.PHANTASMAL_WARDEN]: implemented({
    activation: 0.69,
    damage: [
      { coefficient: 1.656, hits: 12, label: "Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  }),
  [ID.PHANTASMAL_DEFENDER]: implemented({
    activation: 1.155,
    damage: [
      { coefficient: 0.4, hits: 1, label: "Damage", source: "Phantasm", weapon: "phantasm defender" },
    ],
  }),
  [ID.ECHO_OF_MEMORY]: implemented({
    activation: 2.46,
    damage: [
      { coefficient: 0.9, hits: 1, label: "Damage", source: "Phantasm", weapon: "phantasm medium" },
    ],
  }),
  [ID.CHAOS_STORM]: implemented({
    // Measured at 480 ms with Quickness.
    activation: 0.72,
    damage: [
      {
        coefficient: 1.98,
        hits: 6,
        label: "Six pulses",
        source: "Player",
        interval: 1,
      },
    ],
    // Each pulse applies one random condition (Poison/Chill/Weakness).
    // Only Poison deals condition damage; expected value is 6 × (1/3) = 2 stacks.
    conditions: [{ name: "Poisoned", duration: 4, stacks: 2 }],
  }),
  [ID.FLYING_CUTTER]: implemented({
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
  }),
  [ID.UNSTABLE_BLADESTORM]: implemented({
    damage: [
      {
        coefficient: 1,
        hits: 4,
        label: "Storm pulses",
        source: "Player",
        firstDelay: 1,
        interval: 1,
      },
      {
        coefficient: 2,
        hits: 4,
        label: "Launched blades",
        source: "Player",
        firstDelay: 1,
        interval: 1,
      },
    ],
  }),
  [ID.BLADECALL]: implemented({
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
  }),
  [ID.ABSTRACTION]: implemented({
    damage: [
      {
        coefficient: 2.5,
        hits: 1,
        label: "Detonation",
        source: "Player",
        weapon: "rifle",
      },
    ],
  }),
};

export const MESMER_SKILL_OVERRIDES = Object.freeze({
  ...overrideDefinitions,
  [ID.TROUBADOUR_LINGERING_THOUGHTS]: implemented(
    overrideDefinitions[ID.LINGERING_THOUGHTS],
  ),
  [ID.TROUBADOUR_AXES_OF_SYMMETRY]: implemented(
    overrideDefinitions[ID.AXES_OF_SYMMETRY],
  ),
  [ID.TROUBADOUR_BLADECALL]: implemented(
    overrideDefinitions[ID.BLADECALL],
  ),
});

const handledByEngine = new Set([
  ID.MIND_WRACK,
  ID.CRY_OF_FRUSTRATION,
  ID.DIVERSION,
  ID.DISTORTION,
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.BLADESONG_HARMONY,
  ID.BLADESONG_SORROW,
  ID.BLADESONG_DISSONANCE,
  ID.BLADESONG_DISTORTION,
  ID.BLADETURN_REQUIEM,
  ID.CONTINUUM_SPLIT,
  ID.LIVELY_LUTE,
  ID.LIVELY_LUTE_ALTERNATE,
  ID.FLUSTERING_FLUTE,
  ID.DEAFENING_DRUM,
  ID.HARMONIOUS_HARP,
  ID.HARMONIOUS_HARP_ALTERNATE,
  ID.CRESCENDO,
]);

export const isEngineHandledSkill = skillId =>
  handledByEngine.has(Number(skillId));
