import { MESMER_SKILL_IDS as ID } from "./ids.js";

/**
 * Positive-ID terrestrial Mesmer skills absent from the checked-in API
 * snapshot. This module owns identity and presentation only.
 */
export interface MesmerSupplementalSkill {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly type: string;
  readonly weapon: string;
  readonly slot: string;
  readonly specialization?: string;
  readonly environment: string;
  readonly ambush?: boolean;
  readonly flipParentId?: number;
}

const supplementalSkills: MesmerSupplementalSkill[] = [
  {
    id: ID.IMAGINARY_AXES,
    name: "Imaginary Axes",
    description:
      "Ambush. Release phantasmal axes that seek out the nearest target after a short delay.",
    icon: "https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png",
    type: "Weapon",
    weapon: "Axe",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.PHANTOM_RAZOR,
    name: "Phantom Razor",
    description:
      "Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.",
    icon: "https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png",
    type: "Weapon",
    weapon: "Dagger",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.SPLIT_SURGE,
    name: "Split Surge",
    description:
      "Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.",
    icon: "https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png",
    type: "Weapon",
    weapon: "Greatsword",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.EFFERVESCENCE,
    name: "Effervescence",
    description:
      "Ambush. Spray invigorating magic, damaging enemies and healing allies.",
    icon: "https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png",
    type: "Weapon",
    weapon: "Rifle",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.ETHER_BARRAGE,
    name: "Ether Barrage",
    description:
      "Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment.",
    icon: "https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png",
    type: "Weapon",
    weapon: "Scepter",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.FRACTURED_GLASS,
    name: "Fractured Glass",
    description:
      "Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.",
    icon: "https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png",
    type: "Weapon",
    weapon: "Spear",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.CHAOS_VORTEX,
    name: "Chaos Vortex",
    description:
      "Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.",
    icon: "https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png",
    type: "Weapon",
    weapon: "Staff",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.MIRAGE_THRUST,
    name: "Mirage Thrust",
    description:
      "Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.",
    icon: "https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png",
    type: "Weapon",
    weapon: "Sword",
    slot: "Weapon_1",
    specialization: "Mirage",
    environment: "Terrestrial",
    ambush: true,
  },
  {
    id: ID.COUNTERSPELL,
    name: "Counterspell",
    description:
      "Flip skill for Illusionary Counter. Fire a blinding bolt, inflict confusion, and summon one clone on hit.",
    icon: "https://render.guildwars2.com/file/33B7ADCA30B5EF4C1B52F71F39596FDEE9ECD8EB/103776.png",
    type: "Weapon",
    weapon: "Scepter",
    slot: "Weapon_2",
    environment: "Terrestrial",
    flipParentId: ID.ILLUSIONARY_COUNTER,
  },
  {
    id: ID.POWER_SPIKE,
    name: "Power Spike",
    description:
      "Mantra. Damage your target. Reverts to Mantra of Pain once both charges are spent.",
    icon: "https://render.guildwars2.com/file/3519C5C770CCEAF92926D9495999E1F8A23D5AF3/103743.png",
    type: "Utility",
    weapon: "",
    slot: "Utility",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.MANTRA_OF_PAIN,
  },
  {
    id: ID.DIMENSIONAL_APERTURE,
    name: "Dimensional Aperture",
    description:
      "Collapse your singularity into a single-use portal and increase Singularity Shot's recharge.",
    icon: "https://render.guildwars2.com/file/4342CE56CCFF5669FE084891F377B95D1026AFA1/3256364.png",
    type: "Weapon",
    weapon: "Rifle",
    slot: "Weapon_5",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.SINGULARITY_SHOT,
  },
  {
    id: ID.ABSTRACTION,
    name: "Abstraction",
    description:
      "Detonate your beacon, damaging and debilitating enemies while bolstering allies.",
    icon: "https://render.guildwars2.com/file/72E5ACDEAE7571B67F96F9BDA8A271CCCF08957B/3256361.png",
    type: "Weapon",
    weapon: "Rifle",
    slot: "Weapon_3",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.INSPIRING_IMAGERY,
  },
  {
    id: ID.INTO_THE_VOID,
    name: "Into the Void",
    description:
      "Shatter your Temporal Curtain, pulling nearby enemies toward its position.",
    icon: "https://render.guildwars2.com/file/E4D0E740C1700E3ACFBBD25D7F0C0628E0204559/103758.png",
    type: "Weapon",
    weapon: "Focus",
    slot: "Weapon_4",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.TEMPORAL_CURTAIN,
  },
  {
    id: ID.COUNTER_BLADE,
    name: "Counter Blade",
    description: "Shoot a bolt that damages and dazes foes in a line.",
    icon: "https://render.guildwars2.com/file/7ADC0ABCDBA004A5DE085096300DA2B9C191C84C/103792.png",
    type: "Weapon",
    weapon: "Sword",
    slot: "Weapon_4",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.ILLUSIONARY_RIPOSTE,
  },
  {
    id: ID.SWAP,
    name: "Swap",
    description: "Swap places with your clone and immobilize nearby foes.",
    icon: "https://render.guildwars2.com/file/BEDBA7E72F06AA51D124B9B29EA53D4E3FEAFA48/103728.png",
    type: "Weapon",
    weapon: "Sword",
    slot: "Weapon_3",
    specialization: "",
    environment: "Terrestrial",
    flipParentId: ID.ILLUSIONARY_LEAP,
  },
];

export const MESMER_SUPPLEMENTAL_SKILLS: readonly Readonly<
  MesmerSupplementalSkill
>[] = Object.freeze(supplementalSkills.map((skill) => Object.freeze(skill)));
