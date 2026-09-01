/**
 * Focus weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Off-hand only, so it covers slots 4 and 5 in each attunement, including the
 * Fire Shield / Transmute Fire flipover pair.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// One tick per second across Flamewall's nine-second field, shared by its strike and Burning timelines.
const FLAMEWALL_TICK_OFFSETS_MS = [560, 1560, 2560, 3560, 4560, 5560, 6560, 7560, 8560] as const;

/**
 * Skill-id keyed fragments the Core module contributes to the focus catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
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
    quicknessCastTimeMs: 560,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 9,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.1,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
    quicknessCastTimeMs: 0,
    cooldown: 25,
    nextChainId: ID.TRANSMUTE_FIRE,
    aura: 'Fire|4',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  // Consumes the Fire Aura for a strike, Burning, and five Might, then flips back to Fire Shield; the
  // `aura-transmute` marker keeps the flipover visible to rotation loop analysis as a state-gated action.
  [ID.TRANSMUTE_FIRE]: {
    name: 'Transmute Fire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.FIRE_SHIELD,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 840,
            condition: 'Burning',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 5,
        duration: 6,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'aura-transmute'
  },
  [ID.FREEZING_GUST]: {
    name: 'Freezing Gust',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Chilled',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Blast finisher and crowd-control application landing together shortly after the cast ends.
  [ID.COMET]: {
    name: 'Comet',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.75,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 760,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // Projectile-destruction bubble with no offensive packets; the fragment only models its cast time and recharge.
  [ID.SWIRLING_WINDS]: {
    name: 'Swirling Winds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    quicknessCastTimeMs: 560,
    cooldown: 40,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    quicknessCastTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Cripple',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Defensive channel with no packets; its long cast time is the cost the rotation has to pay for it.
  [ID.OBSIDIAN_FLESH]: {
    name: 'Obsidian Flesh',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 3800,
    cooldown: 50,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  }
});
