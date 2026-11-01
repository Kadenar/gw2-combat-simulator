/** Explicit PvE skill mechanics owned by the Spellbreaker Warrior module. */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const SPELLBREAKER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.EARTHSHAKER_ID_40601]: {
    name: 'Earthshaker',
    description: 'Burst. Jump to the targeted location and slam your hammer down, damaging and stunning foes.',
    icon: 'https://render.guildwars2.com/file/B8D91A691871E4EA40645E2DE8F0452643263E9E/103181.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Hammer',
    skillWeapon: WEAPON.HAMMER,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1000,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.75,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ])
  },
  [ID.NATURAL_HEALING]: {
    name: 'Natural Healing',
    description: 'Meditation. Heal for a percentage of your maximum health.',
    icon: 'https://render.guildwars2.com/file/91EBFFD7027A5EC7D26B251EEBA9B7AA1D3EAAB8/1770660.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 25,
    castTimeMs: 667,
    effects: []
  },
  [ID.SKULL_CRACK_ID_41110]: {
    name: 'Skull Crack',
    description: 'Burst. Stun your foe with a skull crack.',
    icon: 'https://render.guildwars2.com/file/F4F19D3AA21DD174389D01ACD9D76433750CE9DF/103280.png',
    type: 'Profession',
    slot: 'Profession_1',

    requiredMainHand: 'Mace',
    // Spellbreaker's level-one variant shares the mace burst's cast and impact timing.
    skillWeapon: WEAPON.MACE,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 560,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.ARCING_SLICE_ID_42707]: {
    name: 'Arcing Slice',
    description:
      'Burst. Deliver a circular attack to foes around you, and gain fury. Deal more damage to foes with low health.',
    icon: 'https://render.guildwars2.com/file/6003B9BAF49D80F30D13E40453C145BF1159572B/103017.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT_ID_42803]: {
    name: 'Combustive Shot',
    description: 'Burst. Ignite the target area, burning nearby foes.',
    icon: 'https://render.guildwars2.com/file/45CE3B6BCD1FBB5B592859C37FC7D35FDA9E482B/103212.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 5
      }
    ]
  },
  [ID.BREAK_ENCHANTMENTS]: {
    name: 'Break Enchantments',
    description:
      'Meditation. Strike foes around you and remove their boons. Deal more damage to foes that lose a boon.',
    icon: 'https://render.guildwars2.com/file/ECC1B92208E4B7E2B5C41351DF09DBC04894A10C/1770663.png',
    // The selected preview may enable charges and edit their between-use interval.
    ammo: 0,
    ammoCastLockout: 0,
    type: 'Utility',
    slot: 'Utility',

    cooldown: 15,
    castTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.EVISCERATE_ID_43566]: {
    name: 'Eviscerate',
    description: 'Burst. Leap at your foe with a devastating attack.',
    icon: 'https://render.guildwars2.com/file/EA325CADCFA2EEF9E2427DD415402E056A6D6CB3/103230.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 5
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.FULL_COUNTER]: {
    name: 'Full Counter',
    description:
      'Burst. Absorb the next attack against you and counterattack all foes around you. Foes struck by the counter attack are interrupted.',
    icon: 'https://render.guildwars2.com/file/3C0BDF7FC49ACA29E1ECD66DE880250AA673FD28/1770662.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1000,
    // The counterattack only occurs after absorbing an incoming attack. The
    // benchmark target never attacks, so activation alone has no effects.
    effects: []
  },
  [ID.WINDS_OF_DISENCHANTMENT]: {
    name: 'Winds of Disenchantment',
    description:
      'Meditation. Create an area of calm in which foes have reduced incoming boon duration and lose boons every interval. Enemy missiles entering this area are blocked.',
    icon: 'https://render.guildwars2.com/file/0C185490CB6D7215360704CA345150D807444968/1770659.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 90,
    castTimeMs: 1000,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Targets never carry boons; only the damage pulses and Lightning field have simulated effects.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 800 + index * 1000, coefficient: 2.25 / 5 }))
      }
    ])
  },
  [ID.PATH_TO_VICTORY_ID_72089]: {
    name: 'Path to Victory',
    description:
      'Burst. Carve a path to victory, dealing damage to enemies in front of you while healing and granting regeneration to nearby allies.',
    icon: 'https://render.guildwars2.com/file/337928249A067249569AA70D78120D0E03257203/3256396.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73014]: {
    name: "Harrier's Toss",
    description:
      'Burst. Jump up and throw a spear at your targeted location, dealing damage in an area. The opponent closest to the epicenter takes additional damage.',
    icon: 'https://render.guildwars2.com/file/FE3E5C674895F8B2F59280552A460FE310BE32A0/3379205.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  }
});
