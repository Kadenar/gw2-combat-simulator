/**
 * Warhorn weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers the off-hand slot 4 and 5 skills across all four attunements. Most entries are
 * long-lived pulsing effects, so their strike and condition packets are authored as shared
 * offset tables and land well after the cast ends. Declarative data merged into the Core
 * skill catalog by `core/skills/index.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';

// Layers keep same-time Vulnerability behind its matching Lightning Orb strike while retaining multi-tick effects.
const LIGHTNING_ORB_STRIKE_TICK_LAYERS = [
  [
    { atMs: 400, coefficient: 0.8 },
    { atMs: 680, coefficient: 0.72 },
    { atMs: 960, coefficient: 0.64 },
    { atMs: 1240, coefficient: 0.56 },
    { atMs: 1520, coefficient: 0.48 },
    { atMs: 1800, coefficient: 0.4 },
    { atMs: 2080, coefficient: 0.32 },
    { atMs: 2360, coefficient: 0.24 },
    { atMs: 2760, coefficient: 0.16 },
    { atMs: 3160, coefficient: 0.08 },
    { atMs: 3600, coefficient: 0.05 },
    { atMs: 4000, coefficient: 0.05 },
    { atMs: 4400, coefficient: 0.05 },
    { atMs: 4800, coefficient: 0.05 },
    { atMs: 5060, coefficient: 0.05 },
    { atMs: 5390, coefficient: 0.05 },
    { atMs: 5790, coefficient: 0.05 },
    { atMs: 6220, coefficient: 0.05 },
    { atMs: 6620, coefficient: 0.05 }
  ],
  [{ atMs: 4800, coefficient: 0.05 }]
] as const;

// Wildfire's last two field pulses overlap only large targets; strikes and Burning share the same packet metadata.
const WILDFIRE_TICKS = [
  ...[1560, 2560, 3560, 4560, 5560, 6560, 7560].map((atMs) => ({ atMs })),
  ...[8560, 9560].map((atMs) => ({ atMs, metadata: { largeHitboxOnly: true } }))
] as const;

// Dust Storm pulses eight times on roughly one-second intervals; strike, Bleeding, and blind
// applications all reuse these offsets.
const DUST_STORM_TICK_OFFSETS_MS = [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640] as const;

/**
 * Skill-id keyed fragments the catalog layers over the raw warhorn skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
export const ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HEAT_SYNC]: {
    name: 'Heat Sync',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Lays an 8s fire field and burns through seven packets, plus two packets on large targets.
  [ID.WILDFIRE]: {
    name: 'Wildfire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 660,
    cooldown: 30,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: WILDFIRE_TICKS.map((tick) => ({
          ...tick,
          coefficient: 0.44,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: WILDFIRE_TICKS.map((tick) => ({
          ...tick,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.TIDAL_SURGE]: {
    name: 'Tidal Surge',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 920,
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
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 920,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // Contributes only a water combo field; no strike or condition packets are modelled.
  [ID.WATER_GLOBE]: {
    name: 'Water Globe',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: []
  },
  [ID.CYCLONE]: {
    name: 'Cyclone',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 800,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 2.5,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
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
  // Travelling orb whose damage decays over nineteen hits down to a 0.05 floor; each hit also
  // applies one Vulnerability stack, and the second layer adds the extra simultaneous 4800ms hit.
  [ID.LIGHTNING_ORB]: withSmallHitboxCap(
    {
      name: 'Lightning Orb',
      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: 'Warhorn',
      attunement: 'Air',
      categories: ['Weapon skill'],
      quicknessCastTimeMs: 440,
      cooldown: 25,
      skillFamily: 'Weapon skill',
      effects: LIGHTNING_ORB_STRIKE_TICK_LAYERS.flatMap((ticks) => [
        strikeTimeline(ticks, { timingAnchor: 'castStart', timingScale: 'cast' }),
        conditionTimeline(
          ticks.map(({ atMs }) => ({
            atMs,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 10
          })),
          { timingAnchor: 'castStart', timingScale: 'cast' }
        )
      ])
    },
    11
  ),
  // Grants Magnetic Aura for 4s alongside Protection; the aura is what other skills transmute.
  [ID.SAND_SQUALL]: {
    name: 'Sand Squall',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    aura: 'Magnetic|4',
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'boon',
        boon: 'Protection',
        stacks: 1,
        duration: 2,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Eight pulses that each strike, bleed, and blind, with Resistance granted on the first pulse.
  [ID.DUST_STORM]: withSmallHitboxCap(
    {
      name: 'Dust Storm',
      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: 'Warhorn',
      attunement: 'Earth',
      categories: ['Weapon skill'],
      quicknessCastTimeMs: 840,
      cooldown: 30,
      skillFamily: 'Weapon skill',
      effects: [
        {
          type: 'strike',
          ticks: DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            coefficient: 0.3
          })),
          timingAnchor: 'castStart',
          timingScale: 'cast'
        },
        {
          type: 'condition',
          ticks: DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: 'Bleeding',
            stacks: 2,
            duration: 10
          })),
          timingAnchor: 'castStart',
          timingScale: 'cast',
          metadata: {}
        },
        ...DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
          type: 'blind' as const,
          atMs,
          applications: 1,
          timingAnchor: 'castStart' as const,
          timingScale: 'cast' as const,
          controlKind: 'blind'
        })),
        {
          type: 'boon',
          boon: 'Resistance',
          stacks: 1,
          duration: 4,
          atMs: 1560,
          timingAnchor: 'castStart',
          timingScale: 'cast',
          metadata: {}
        }
      ]
    },
    6
  )
});
