import {
  AURA,
  WEAPON,
  COMBO_FIELD,
  RECIPIENT,
  COMBO_FINISHER,
  BOON,
  CONDITION,
  CONTROL
} from '#gw2/platform/constants.js';
/**
 * Focus weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Off-hand only, so it covers slots 4 and 5 in each attunement, including the
 * Fire Shield / Transmute Fire flipover pair.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * Skill-id keyed fragments the Core module contributes to the focus catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Persistent fire field whose damage packets are tagged `field-tick`, letting Persisting Flames
  // recognize and extend both the field and its ticks.
  [ID.FLAMEWALL]: {
    name: 'Flamewall',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    interruptCommitMs: 480,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
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
  // Instant Fire Aura grant that flips the slot to Transmute Fire; the cast hook applies the declared aura.
  [ID.FIRE_SHIELD]: {
    name: 'Fire Shield',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 25,
    nextChainId: ID.TRANSMUTE_FIRE,
    aura: { kind: AURA.FIRE, duration: 4 },
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Consumes the Fire Aura for a strike, Burning, and five Might, then flips back to Fire Shield.
  [ID.TRANSMUTE_FIRE]: {
    // Consume all live matching auras on commitment, regardless of which skill or trait granted them.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.transmute-aura' } }],
    name: 'Transmute Fire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 360,
    interruptCommitMs: 280,
    cooldown: 10,
    nextChainId: ID.FIRE_SHIELD,
    skillFamily: 'Weapon skill',
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
    )
  },
  [ID.FREEZING_GUST]: {
    name: 'Freezing Gust',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.25 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
    ])
  },
  // Blast finisher and crowd-control application landing together shortly after the cast ends.
  [ID.COMET]: {
    name: 'Comet',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 25,
    skillFamily: 'Weapon skill',
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
  // Projectile-destruction bubble with no offensive packets; the fragment only models its cast time and recharge.
  [ID.SWIRLING_WINDS]: {
    name: 'Swirling Winds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Pure crowd control: a control application with no strike, so it contributes no damage.
  [ID.GALE]: {
    name: 'Gale',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 40,
    skillFamily: 'Weapon skill',
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
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.FOCUS,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Weapon skill',
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
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.FOCUS,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 3800,
    cooldown: 50,
    skillFamily: 'Weapon skill',
    effects: []
  }
});
