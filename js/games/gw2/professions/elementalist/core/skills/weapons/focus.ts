/**
 * Focus weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Off-hand only, so it covers slots 4 and 5 in each attunement, including the
 * Fire Shield / Transmute Fire flipover pair.
 */

import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Flamewall pulses on creation and each second through its eight-second duration, including the final boundary.
const FLAMEWALL_TICK_OFFSETS_MS = [560, 1560, 2560, 3560, 4560, 5560, 6560, 7560, 8560] as const;

/**
 * Skill-id keyed fragments the Core module contributes to the focus catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Persistent fire field whose damage packets are tagged `field-tick`, letting Persisting Flames
  // recognize and extend both the field and its ticks.
  [ID.FLAMEWALL]: {
    name: 'Flamewall',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    interruptCommitMs: 480,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.1,
          damageKind: 'field-tick'
        }))
      },
      {
        type: 'condition',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        })),
        metadata: {}
      }
    ])
  },
  // Instant Fire Aura grant that flips the slot to Transmute Fire; `aura: 'Fire|4'` is the aura/duration
  // pair the cast-effects layer reads when applying it.
  [ID.FIRE_SHIELD]: {
    name: 'Fire Shield',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 25,
    nextChainId: ID.TRANSMUTE_FIRE,
    aura: 'Fire|4',
    skillFamily: 'Weapon skill',
    effects: []
  },
  // Consumes the Fire Aura for a strike, Burning, and five Might, then flips back to Fire Shield.
  [ID.TRANSMUTE_FIRE]: {
    name: 'Transmute Fire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
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
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 6, metadata: {} },
        { type: 'boon', boon: 'Might', stacks: 5, duration: 6, metadata: {} }
      ]
    )
  },
  [ID.FREEZING_GUST]: {
    name: 'Freezing Gust',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.25 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  // Blast finisher and crowd-control application landing together shortly after the cast ends.
  [ID.COMET]: {
    name: 'Comet',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
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
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {},
        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  // Projectile-destruction bubble with no offensive packets; the fragment only models its cast time and recharge.
  [ID.SWIRLING_WINDS]: {
    name: 'Swirling Winds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
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
    weapon: 'Focus',
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
        controlKind: 'crowd-control'
      }
    ]
  },
  // Instant cast, so its blast finisher and Cripple both resolve at cast start.
  [ID.MAGNETIC_WAVE]: {
    name: 'Magnetic Wave',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
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
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'condition', condition: 'Cripple', stacks: 1, duration: 5, metadata: {} }
    ])
  },
  // Defensive channel with no packets; its long cast time is the cost the rotation has to pay for it.
  [ID.OBSIDIAN_FLESH]: {
    name: 'Obsidian Flesh',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 3800,
    cooldown: 50,
    skillFamily: 'Weapon skill',
    effects: []
  }
});
