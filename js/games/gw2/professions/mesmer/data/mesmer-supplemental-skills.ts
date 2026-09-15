import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/**
 * Positive-ID Mesmer skills absent from the checked-in API snapshot. This
 * module owns identity and presentation only.
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
  readonly flipParentId?: number;
}

const supplementalSkills: MesmerSupplementalSkill[] = [
  {
    id: ID.COUNTERSPELL,
    name: 'Counterspell',
    description:
      'Flip skill for Illusionary Counter. Fire a blinding bolt, inflict confusion, and summon one clone on hit.',
    icon: 'https://render.guildwars2.com/file/33B7ADCA30B5EF4C1B52F71F39596FDEE9ECD8EB/103776.png',
    type: 'Weapon',
    weapon: 'Scepter',
    slot: 'Weapon_2',
    flipParentId: ID.ILLUSIONARY_COUNTER
  },
  {
    id: ID.POWER_SPIKE,
    name: 'Power Spike',
    description: 'Mantra. Damage your target. Reverts to Mantra of Pain once both charges are spent.',
    icon: 'https://render.guildwars2.com/file/3519C5C770CCEAF92926D9495999E1F8A23D5AF3/103743.png',
    type: 'Utility',
    weapon: '',
    slot: 'Utility',
    specialization: '',
    flipParentId: ID.MANTRA_OF_PAIN
  },
  {
    id: ID.DIMENSIONAL_APERTURE,
    name: 'Dimensional Aperture',
    description: "Collapse your singularity into a single-use portal and increase Singularity Shot's recharge.",
    icon: 'https://render.guildwars2.com/file/4342CE56CCFF5669FE084891F377B95D1026AFA1/3256364.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    specialization: '',
    flipParentId: ID.SINGULARITY_SHOT
  },
  {
    id: ID.ABSTRACTION,
    name: 'Abstraction',
    description: 'Detonate your beacon, damaging and debilitating enemies while bolstering allies.',
    icon: 'https://render.guildwars2.com/file/72E5ACDEAE7571B67F96F9BDA8A271CCCF08957B/3256361.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    specialization: '',
    flipParentId: ID.INSPIRING_IMAGERY
  },
  {
    id: ID.INTO_THE_VOID,
    name: 'Into the Void',
    description: 'Shatter your Temporal Curtain, pulling nearby enemies toward its position.',
    icon: 'https://render.guildwars2.com/file/E4D0E740C1700E3ACFBBD25D7F0C0628E0204559/103758.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    specialization: '',
    flipParentId: ID.TEMPORAL_CURTAIN
  },
  {
    id: ID.COUNTER_BLADE,
    name: 'Counter Blade',
    description: 'Shoot a bolt that damages and dazes foes in a line.',
    icon: 'https://render.guildwars2.com/file/7ADC0ABCDBA004A5DE085096300DA2B9C191C84C/103792.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    specialization: '',
    flipParentId: ID.ILLUSIONARY_RIPOSTE
  },
  {
    id: ID.SWAP,
    name: 'Swap',
    description: 'Swap places with your clone and immobilize nearby foes.',
    icon: 'https://render.guildwars2.com/file/BEDBA7E72F06AA51D124B9B29EA53D4E3FEAFA48/103728.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    specialization: '',
    flipParentId: ID.ILLUSIONARY_LEAP
  }
];

export const MESMER_SUPPLEMENTAL_SKILLS: readonly Readonly<MesmerSupplementalSkill>[] = Object.freeze(
  supplementalSkills.map((skill) => Object.freeze(skill))
);
