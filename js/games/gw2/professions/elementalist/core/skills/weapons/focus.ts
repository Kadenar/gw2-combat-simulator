/**
 * Focus weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Off-hand only, so it covers slots 4 and 5 in each attunement, including the
 * Fire Shield / Transmute Fire flipover pair.
 */
import {
  AURA,
  BOON,
  COMBO_FIELD,
  COMBO_FINISHER,
  CONDITION,
  CONTROL,
  RECIPIENT,
  WEAPON
} from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * Skill-id keyed definitions the Core module contributes to the focus catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Persistent fire field whose damage packets are tagged `field-tick`, letting Persisting Flames
  // recognize and extend both the field and its ticks.
  [ID.FLAMEWALL]: {
    name: 'Flamewall',
    description: 'Create a wall of flame at the target area that burns foes.',
    icon: 'https://render.guildwars2.com/file/B84B697E69B44D5EC3A0306AA2FB3128BBF30F78/103271.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    interruptCommitMs: 480,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    // Flamewall pulses on creation and each second through its eight-second duration, including the final boundary.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.1,
        damageKind: 'field-tick',
        atMs: 560,
        applications: 9,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2.5,
        atMs: 560,
        applications: 9,
        intervalMs: 1000
      }
    ])
  },
  // Instant Fire Aura grant that flips the slot to Transmute Fire; the declared effect grants the aura.
  [ID.FIRE_SHIELD]: {
    name: 'Fire Shield',
    description:
      'Envelop yourself in a fiery shield that burns foes and grants might each time you are struck (cooldown of 1 second per attacker).',
    icon: 'https://render.guildwars2.com/file/2AE8672D7A08BB4129B6F0F40C2BC10642D55C28/102884.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.FIRE, duration: 4 }]
  },
  // Consumes the Fire Aura for a strike, Burning, and five Might, then flips back to Fire Shield.
  [ID.TRANSMUTE_FIRE]: {
    name: 'Transmute Fire',
    description: 'Use the energy of the fire aura to cause an explosion, damaging enemies and benefiting allies.',
    icon: 'https://render.guildwars2.com/file/7AD6E1794841A50751E02F0C367E920CF5066F65/2029300.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    interruptCommitMs: 280,
    effects: impactEffects(
      { atMs: 840, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 6 },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          // Share this support boon with affected allies within its recipient cap.
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          stacks: 5,
          duration: 6
        }
      ]
    ),
    // Consume all live matching auras on commitment, regardless of which skill or trait granted them.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.transmute-aura' } }]
  },
  [ID.FREEZING_GUST]: {
    name: 'Freezing Gust',
    description: 'Chill your foe for a brief time.',
    icon: 'https://render.guildwars2.com/file/C518536FBD1734CD9A19F4480153977BD09CBFD2/103344.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Water',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.25 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
    ])
  },
  // Blast finisher and crowd-control application landing together shortly after the cast ends.
  [ID.COMET]: {
    name: 'Comet',
    description: 'Drop a comet of ice on target foe, damaging and dazing foes in the area.',
    icon: 'https://render.guildwars2.com/file/CE2D206242C6DDB571784315ABF4B51CBAC090A9/103319.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Water',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.75,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  // Projectile-destruction bubble with no offensive packets; the definition only models its cast time and recharge.
  [ID.SWIRLING_WINDS]: {
    name: 'Swirling Winds',
    description: 'Create a swirling wind that blocks projectiles.',
    icon: 'https://render.guildwars2.com/file/2931CBED030FDBF30F0A0B293A0010925B90FDA6/103250.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Air',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: []
  },
  // Pure crowd control: a control application with no strike, so it contributes no damage.
  [ID.GALE]: {
    name: 'Gale',
    description: 'Knock down your foe with a charged wind blast.',
    icon: 'https://render.guildwars2.com/file/54C5B6544376D03C1205955030300318E922083A/103345.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Air',

    cooldown: 40,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    effects: [
      {
        type: 'control',
        atMs: 560,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: CONTROL.KNOCKDOWN
      }
    ]
  },
  // Instant cast, so its blast finisher and Cripple both resolve at cast start.
  [ID.MAGNETIC_WAVE]: {
    name: 'Magnetic Wave',
    description: 'Damage foes, cure three of your conditions, and reflect projectiles with a magnetic surge.',
    icon: 'https://render.guildwars2.com/file/BBF16D6BF9CDA755420759F7D5F8D3FF6B2065DA/103343.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Earth',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 5 }
    ])
  },
  // Defensive channel with no packets; its long cast time is the cost the rotation has to pay for it.
  [ID.OBSIDIAN_FLESH]: {
    name: 'Obsidian Flesh',
    description: 'Envelop yourself in stony armor, making yourself invulnerable.',
    icon: 'https://render.guildwars2.com/file/F12B0EDB12DD216E110ADA44A238559AF27396AD/103330.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Earth',

    cooldown: 50,
    skillFamily: 'Weapon skill',
    castTimeMs: 3800,
    effects: []
  }
});
