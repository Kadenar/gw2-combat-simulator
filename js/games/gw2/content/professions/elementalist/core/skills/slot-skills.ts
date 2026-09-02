/**
 * Canonical Core elementalist skill fragments grouped by their GW2 owner.
 *
 * Covers the heal / utility / elite slots: arcane skills, signets, glyphs (including the
 * attunement-specific Elemental Power and Storms variants), conjures, cantrips, and the two
 * Glyph of Elementals summons.
 *
 * These are pure data fragments — no behavior. Anything stateful is delegated by marker field:
 * `elementalistStateMachine` hands the skill to a subsystem (core/skills/elementals.ts for the
 * summons), and `mechanicTriggers` names a handler in core/skills/cast-effects.ts.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import {
  CAST_SCALED_PACKET_TIMING,
  GLYPH_OF_STORMS_AIR_STRIKE_TICK_LAYERS,
  GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS,
  GLYPH_OF_STORMS_WATER_STRIKE_TICKS
} from '#gw2/content/professions/elementalist/core/skills/skill-timelines.js';

/**
 * Skill-id → fragment table for the Core heal, utility, and elite slot skills. Entries are keyed
 * by GW2 skill id and overlay the catalog entry of the same id.
 */
export const ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // --- Heals ------------------------------------------------------------------
  // Healing is not modelled, so the heal skills only carry their offensive/boon side effects
  // (Signet of Restoration is pure sustain and therefore has none).
  [ID.ARCANE_BRILLIANCE]: {
    name: 'Arcane Brilliance',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Arcane'],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Arcane',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.5,
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
      }
    ]
  },
  [ID.SIGNET_OF_RESTORATION]: {
    name: 'Signet of Restoration',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Signet'],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: 'Signet',
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_HARMONY]: {
    name: 'Glyph of Elemental Harmony',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Glyph'],
    quicknessCastTimeMs: 800,
    cooldown: 20,
    skillFamily: 'Glyph',
    effects: [
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 20,
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // --- Arcane -----------------------------------------------------------------
  // Blast and Wave are ammo skills: `cooldown` is the short between-charge lockout while
  // `ammoRecharge` refills a charge. Arcane Echo carries no packets — its recast window is
  // driven from core/skills/cast-effects.ts.
  [ID.ARCANE_BLAST]: {
    name: 'Arcane Blast',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 0,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 20,
    skillFamily: 'Arcane',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.4,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ARCANE_ECHO]: {
    name: 'Arcane Echo',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Arcane',
    effects: []
  },
  [ID.ARCANE_WAVE]: {
    name: 'Arcane Wave',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 760,
    cooldown: 2,
    ammo: 2,
    ammoRecharge: 25,
    skillFamily: 'Arcane',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1.4,
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
        atMs: 800,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // --- Conjures ---------------------------------------------------------------
  // Summoning a bundle has no packets of its own; the cast swaps the equipped conjure and arms
  // the ground pickup in core/skills/conjures.ts, and the bundle's weapon skills live in
  // misc-skills.ts. (Conjure Fiery Greatsword, below, is the exception — it also strikes.)
  [ID.CONJURE_FROST_BOW]: {
    name: 'Conjure Frost Bow',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Conjure'],
    quicknessCastTimeMs: 480,
    cooldown: 60,
    skillFamily: 'Conjure',
    effects: []
  },
  [ID.CONJURE_LIGHTNING_HAMMER]: {
    name: 'Conjure Lightning Hammer',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Conjure'],
    quicknessCastTimeMs: 880,
    cooldown: 60,
    skillFamily: 'Conjure',
    effects: []
  },
  // --- Glyph of Elemental Power (one variant per attunement) --------------------
  // The four entries share one slot; `attunement` is the gate — availability rejects a variant
  // unless it matches the current primary attunement. Only the Fire and Air variants carry
  // packets; Water and Earth are modelled as no-ops.
  [ID.GLYPH_OF_ELEMENTAL_POWER_FIRE]: {
    name: 'Glyph of Elemental Power (Fire)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 400,
            condition: 'Burning',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_WATER]: {
    name: 'Glyph of Elemental Power (Water)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Water',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_AIR]: {
    name: 'Glyph of Elemental Power (Air)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Air',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 400,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_EARTH]: {
    name: 'Glyph of Elemental Power (Earth)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    effects: []
  },
  // --- Glyph of Storms (one variant per attunement) ------------------------------
  // Same attunement gate as above, but each variant is a long ground field with its own
  // cooldown: eleven one-second pulses (Fire/Earth), or an EVTC-derived tick timeline
  // (Water/Air). Field pulses are tagged `damageKind: 'field-tick'`.
  [ID.GLYPH_OF_STORMS_FIRE]: {
    name: 'Glyph of Storms (Fire)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 25,
    skillFamily: 'Glyph',
    effects: [
      {
        type: 'strike',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.5,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.GLYPH_OF_STORMS_WATER]: {
    name: 'Glyph of Storms (Water)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Water',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: 'Glyph',
    effects: [
      strikeTimeline(GLYPH_OF_STORMS_WATER_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        GLYPH_OF_STORMS_WATER_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
  },
  // Air is authored as several parallel tick layers so that same-timestamp Vulnerability lands
  // after the hit that caused it; each layer contributes its own strike + condition pair.
  [ID.GLYPH_OF_STORMS_AIR]: {
    name: 'Glyph of Storms (Air)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Air',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 60,
    skillFamily: 'Glyph',
    effects: GLYPH_OF_STORMS_AIR_STRIKE_TICK_LAYERS.flatMap((ticks) => [
      strikeTimeline(ticks, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        ticks.map(({ atMs }) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 2,
          duration: 8
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ])
  },
  // Earth (Sandstorm) trades damage for control: a near-zero strike coefficient plus eleven
  // one-second blind applications expressed as a single repeating packet.
  [ID.GLYPH_OF_STORMS_EARTH]: {
    name: 'Glyph of Storms (Earth)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 40,
    skillFamily: 'Glyph',
    effects: [
      {
        type: 'strike',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.045454545454545456,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'blind',
        atMs: 880,
        applications: 11,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'blind'
      }
    ]
  },
  // --- Signets ------------------------------------------------------------------
  // Only the active is authored here. Signet of Fire is the one signet whose passive is
  // simulated (a precision bonus), so its cast fires a mechanic trigger to switch that passive
  // off for the recharge; Signet of Earth's passive has no damage-model effect.
  [ID.SIGNET_OF_FIRE]: {
    name: 'Signet of Fire',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Signet'],
    quicknessCastTimeMs: 520,
    cooldown: 12,
    skillFamily: 'Signet',
    // Activating the signet disables its passive until recharge unless Written in Stone preserves it.
    mechanicTriggers: [
      {
        type: 'elementalist.core.disable-signet-of-fire-passive',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 440,
            condition: 'Burning',
            stacks: 2,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SIGNET_OF_EARTH]: {
    name: 'Signet of Earth',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Signet'],
    quicknessCastTimeMs: 520,
    cooldown: 15,
    skillFamily: 'Signet',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 440,
            condition: 'Bleeding',
            stacks: 4,
            duration: 9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 440,
            condition: 'Immobilize',
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
  // --- Elites --------------------------------------------------------------------
  // Unlike the utility conjures this one also strikes, and its hit lands after the cast ends.
  [ID.CONJURE_FIERY_GREATSWORD]: {
    name: 'Conjure Fiery Greatsword',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Conjure'],
    quicknessCastTimeMs: 1160,
    cooldown: 180,
    skillFamily: 'Conjure',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1440,
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
            atMs: 1440,
            condition: 'Burning',
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
  // The two Glyph of Elementals variants (Fire / Earth) share the elite slot and produce no
  // packets themselves: `elementalistStateMachine: 'summoned-elemental'` routes the cast to the
  // companion subsystem in core/skills/elementals.ts, which owns the summon's lifetime, attack
  // loop, and post-expiry recharge — that subsystem also blocks a recast while the elemental is
  // alive and re-arms the cooldown from the moment it expires.
  [ID.GLYPH_OF_ELEMENTALS]: {
    name: 'Glyph of Elementals',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Glyph'],
    quicknessCastTimeMs: 0,
    cooldown: 190,
    skillFamily: 'Glyph',
    effects: [],
    elementalistStateMachine: 'summoned-elemental'
  },
  [ID.GLYPH_OF_ELEMENTALS_EARTH]: {
    name: 'Glyph of Elementals (Earth)',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Glyph'],
    quicknessCastTimeMs: 0,
    cooldown: 190,
    skillFamily: 'Glyph',
    effects: [],
    elementalistStateMachine: 'summoned-elemental'
  },
  // --- Cantrips ---------------------------------------------------------------
  // Instant cast; only the offensive burn and the self Might are modelled (the condition
  // cleanse it is named for has no damage-model effect).
  [ID.CLEANSING_FIRE]: {
    name: 'Cleansing Fire',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Cantrip'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Cantrip',
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 2,
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
        stacks: 3,
        duration: 9,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
