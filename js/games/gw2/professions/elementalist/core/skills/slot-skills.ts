/**
 * Canonical Core elementalist skill definitions grouped by their GW2 owner.
 *
 * Covers the heal / utility / elite slots: arcane skills, signets, glyphs (including the
 * attunement-specific Elemental Power and Storms variants), conjures, cantrips, and the two
 * Glyph of Elementals summons.
 *
 * These are pure data definitions - no behavior. Stateful behavior is owned by the corresponding
 * mechanic subsystem, while `tasks` names handlers in `core/execution/index.ts`.
 */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { ELEMENTALIST_GLYPHS } from '#gw2/professions/elementalist/data/glyphs.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Skill-id → definition table for the Core heal, utility, and elite slot skills. Entries are keyed
 * by GW2 skill ID and supply complete catalog entries.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  // --- Heals ------------------------------------------------------------------
  // Healing is not modelled, so the heal skills only carry their offensive/boon side effects
  // (Signet of Restoration is pure sustain and therefore has none).
  [ID.ARCANE_BRILLIANCE]: {
    name: 'Arcane Brilliance',
    icon: 'https://render.guildwars2.com/file/09A60F4FF1020AD1CB78FC7FF21F10306AF7DF0E/699524.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    skillFamily: 'Arcane',
    castTimeMs: 640,
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
                finisherType: COMBO_FINISHER.BLAST
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SIGNET_OF_RESTORATION]: {
    name: 'Signet of Restoration',
    icon: 'https://render.guildwars2.com/file/3FA4D3DCA80A06036E7F6C77E84D94466D157766/103321.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    skillFamily: 'Signet',
    castTimeMs: 440,
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_HARMONY]: {
    name: 'Glyph of Elemental Harmony',
    icon: 'https://render.guildwars2.com/file/26026B59966B4378C538E0513059CF1901E39DCF/1424228.png',
    loadoutSkillId: 5569,
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    skillFamily: 'Glyph',
    castTimeMs: 800,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 3,
        duration: 20,
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // --- Arcane -----------------------------------------------------------------
  // Blast and Wave are ammo skills: `cooldown` is the short between-charge lockout while
  // `cooldown` refills a charge. Arcane Echo carries no packets - its recast window is
  // driven from core/execution/index.ts.
  [ID.ARCANE_BLAST]: {
    name: 'Arcane Blast',
    icon: 'https://render.guildwars2.com/file/BCEB22C05BD13F226612C81339AF9A7647F7B454/103229.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    ammo: 3,

    skillFamily: 'Arcane',
    castTimeMs: 0,
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
                finisherType: COMBO_FINISHER.PROJECTILE
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ARCANE_ECHO]: {
    name: 'Arcane Echo',
    icon: 'https://render.guildwars2.com/file/AD24BD1B231424D2A8F223A6F899AC34D6AAAB26/103356.png',
    // The skill owns its window; like Mimic, the consuming weapon skill's recharge becomes one base second.
    duration: 10,
    type: 'Utility',
    slot: 'Utility',

    cooldown: 15,
    skillFamily: 'Arcane',
    castTimeMs: 0,
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.arm-arcane-echo' } }]
  },
  [ID.ARCANE_WAVE]: {
    name: 'Arcane Wave',
    icon: 'https://render.guildwars2.com/file/367C5408D29E1C49AE52ED18A2EFD76C1B40EB5A/103372.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
    ammo: 2,

    skillFamily: 'Arcane',
    castTimeMs: 760,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.4,
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
  // --- Conjures ---------------------------------------------------------------
  // Summoning a bundle has no packets of its own; the cast swaps the equipped conjure and arms
  // the ground pickup in core/mechanics/conjures.ts, and the bundle's weapon skills live in
  // conjure-skills.ts. (Conjure Fiery Greatsword, below, is the exception - it also strikes.)
  [ID.CONJURE_FROST_BOW]: {
    name: 'Conjure Frost Bow',
    icon: 'https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png',
    // The equipped bundle and its ground copy share this skill-owned lifetime.
    duration: 30,
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Utility',
    slot: 'Utility',

    cooldown: 60,
    skillFamily: 'Conjure',
    castTimeMs: 480,
    // The held Frost Bow grants duration, including copies acquired by pickup.
    modifiers: [
      {
        id: 'elementalist.frost-bow-condition-duration',
        scope: 'profession',
        target: MODIFIER_TARGET.CONDITION_DURATION,
        operation: 'multiply',
        factor: 1.2,
        when: (context) => wieldedConjure(context) === 'Frost Bow'
      }
    ],
    effects: [],
    // Equip this bundle and create its one-use ground copy on commitment, then emit the weapon-swap event.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.equip-conjure' } }]
  },
  [ID.CONJURE_LIGHTNING_HAMMER]: {
    name: 'Conjure Lightning Hammer',
    icon: 'https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png',
    // The equipped bundle and its ground copy share this skill-owned lifetime.
    duration: 30,
    // Wielding the conjure grants these attributes, including when acquiring its ground copy.
    attributeBonuses: { ferocity: 75, precision: 180 },
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Utility',
    slot: 'Utility',

    cooldown: 60,
    skillFamily: 'Conjure',
    castTimeMs: 880,
    effects: [],
    // Equip this bundle and create its one-use ground copy on commitment, then emit the weapon-swap event.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.equip-conjure' } }]
  },
  // --- Glyph of Elemental Power (one variant per attunement) --------------------
  // The four entries share one slot; `attunement` is the gate - availability rejects a variant
  // unless it matches the current primary attunement. Only the Fire and Air variants carry
  // packets; Water and Earth are modelled as no-ops.
  // The selectable glyph resolves to its live elemental payload before cast acceptance.
  [ID.GLYPH_OF_ELEMENTAL_POWER]: {
    name: 'Glyph of Elemental Power',
    selector: ELEMENTALIST_GLYPHS[ID.GLYPH_OF_ELEMENTAL_POWER],
    icon: 'https://render.guildwars2.com/file/0805084EF739CEDD5C9678561C331D7F0B01590B/1424236.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Glyph',
    patchAuthoringExcluded: true
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_FIRE]: {
    name: 'Glyph of Elemental Power (Fire)',
    icon: 'https://render.guildwars2.com/file/0805084EF739CEDD5C9678561C331D7F0B01590B/1424236.png',
    loadoutSkillId: ID.GLYPH_OF_ELEMENTAL_POWER,
    slotSelectable: false,
    displayName: 'Glyph of Elemental Power',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',

    cooldown: 25,
    skillFamily: 'Glyph',
    castTimeMs: 480,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.5 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 6
      }
    ])
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_WATER]: {
    name: 'Glyph of Elemental Power (Water)',
    icon: 'https://render.guildwars2.com/file/BB18F50D1F7E7F59BFCBC521F6EBD9754522B22D/1424237.png',
    loadoutSkillId: ID.GLYPH_OF_ELEMENTAL_POWER,
    slotSelectable: false,
    displayName: 'Glyph of Elemental Power',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Water',

    cooldown: 25,
    skillFamily: 'Glyph',
    castTimeMs: 480,
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_AIR]: {
    name: 'Glyph of Elemental Power (Air)',
    icon: 'https://render.guildwars2.com/file/B4E00C980DE7F1CB0BE62F3901EB031067F302F3/1424234.png',
    loadoutSkillId: ID.GLYPH_OF_ELEMENTAL_POWER,
    slotSelectable: false,
    displayName: 'Glyph of Elemental Power',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Air',

    cooldown: 25,
    skillFamily: 'Glyph',
    castTimeMs: 480,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_EARTH]: {
    name: 'Glyph of Elemental Power (Earth)',
    icon: 'https://render.guildwars2.com/file/C8AEFA0A46F573F37E7902257772AD9A5E742BBD/1424235.png',
    loadoutSkillId: ID.GLYPH_OF_ELEMENTAL_POWER,
    slotSelectable: false,
    displayName: 'Glyph of Elemental Power',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',

    cooldown: 25,
    skillFamily: 'Glyph',
    castTimeMs: 480,
    effects: []
  },
  // --- Glyph of Storms (one variant per attunement) ------------------------------
  // Same attunement gate as above, but each variant is a long ground field with its own
  // cooldown: eleven one-second pulses (Fire/Earth), or an EVTC-derived tick timeline
  // (Water/Air). Field pulses are tagged `damageKind: 'field-tick'`.
  // The selectable glyph resolves to its live elemental payload before cast acceptance.
  [ID.GLYPH_OF_STORMS]: {
    name: 'Glyph of Storms',
    selector: ELEMENTALIST_GLYPHS[ID.GLYPH_OF_STORMS],
    icon: 'https://render.guildwars2.com/file/53207A9159611359DD9E4001F530F63CA7627FAD/103393.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Glyph',
    patchAuthoringExcluded: true
  },
  [ID.GLYPH_OF_STORMS_FIRE]: {
    name: 'Glyph of Storms (Fire)',
    icon: 'https://render.guildwars2.com/file/53207A9159611359DD9E4001F530F63CA7627FAD/103393.png',
    loadoutSkillId: ID.GLYPH_OF_STORMS,
    slotSelectable: false,
    displayName: 'Glyph of Storms',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',

    cooldown: 25,
    skillFamily: 'Glyph',
    castTimeMs: 1120,
    interruptCommitMs: 1080,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880].map((atMs) => ({
          atMs,
          coefficient: 0.5,
          damageKind: 'field-tick'
        }))
      },
      {
        type: 'condition',
        ticks: [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.GLYPH_OF_STORMS_WATER]: withSmallHitboxCap(
    {
      name: 'Glyph of Storms (Water)',
      icon: 'https://render.guildwars2.com/file/53207A9159611359DD9E4001F530F63CA7627FAD/103393.png',
      loadoutSkillId: ID.GLYPH_OF_STORMS,
      slotSelectable: false,
      displayName: 'Glyph of Storms',

      type: 'Utility',
      slot: 'Utility',
      attunement: 'Water',

      cooldown: 30,
      skillFamily: 'Glyph',
      castTimeMs: 1120,
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        strikeTimeline([
          { atMs: 1600, coefficient: 0.8 },
          { atMs: 1920, coefficient: 0.72 },
          { atMs: 2240, coefficient: 0.64 },
          { atMs: 2560, coefficient: 0.56 },
          { atMs: 2880, coefficient: 0.48 },
          { atMs: 3200, coefficient: 0.4 },
          { atMs: 3520, coefficient: 0.32 },
          { atMs: 3840, coefficient: 0.32 },
          { atMs: 4160, coefficient: 0.32 },
          { atMs: 4480, coefficient: 0.32 },
          { atMs: 4800, coefficient: 0.32 },
          { atMs: 5120, coefficient: 0.32 },
          { atMs: 5440, coefficient: 0.32 },
          { atMs: 5760, coefficient: 0.32 },
          { atMs: 6080, coefficient: 0.32 },
          { atMs: 6400, coefficient: 0.32 },
          { atMs: 6720, coefficient: 0.32 },
          { atMs: 7040, coefficient: 0.32 }
        ]),
        conditionTimeline(
          [
            1600, 1920, 2240, 2560, 2880, 3200, 3520, 3840, 4160, 4480, 4800, 5120, 5440, 5760, 6080, 6400, 6720, 7040
          ].map((atMs) => ({
            atMs,
            condition: CONDITION.CHILLED,
            stacks: 1,
            duration: 3
          }))
        )
      ])
    },
    11
  ),
  // Air commits when its first 880ms packets launch; its field keeps ticking after the caster
  // cancels the remaining animation. Parallel layers keep Vulnerability behind its source hit.
  [ID.GLYPH_OF_STORMS_AIR]: withSmallHitboxCap(
    {
      name: 'Glyph of Storms (Air)',
      icon: 'https://render.guildwars2.com/file/53207A9159611359DD9E4001F530F63CA7627FAD/103393.png',
      loadoutSkillId: ID.GLYPH_OF_STORMS,
      slotSelectable: false,
      displayName: 'Glyph of Storms',

      type: 'Utility',
      slot: 'Utility',
      attunement: 'Air',

      cooldown: 60,
      skillFamily: 'Glyph',
      castTimeMs: 1120,
      interruptCommitMs: 880,
      effects: [
        ...[
          [
            { atMs: 880, coefficient: 0.825 },
            { atMs: 1400, coefficient: 0.70125 },
            { atMs: 1560, coefficient: 0.66 },
            { atMs: 1680, coefficient: 0.61875 },
            { atMs: 1880, coefficient: 0.5775 },
            { atMs: 2200, coefficient: 0.53625 },
            { atMs: 2400, coefficient: 0.495 },
            { atMs: 2480, coefficient: 0.45375 },
            { atMs: 2840, coefficient: 0.4125 },
            { atMs: 2880, coefficient: 0.37125 },
            { atMs: 3280, coefficient: 0.33 },
            { atMs: 3400, coefficient: 0.28875 },
            { atMs: 3480, coefficient: 0.2475 },
            { atMs: 3880, coefficient: 0.2475 },
            { atMs: 4080, coefficient: 0.2475 },
            { atMs: 4160, coefficient: 0.2475 },
            { atMs: 4400, coefficient: 0.2475 },
            { atMs: 4800, coefficient: 0.2475 },
            { atMs: 4880, coefficient: 0.2475 },
            { atMs: 5400, coefficient: 0.2475 },
            { atMs: 5440, coefficient: 0.2475 },
            { atMs: 5680, coefficient: 0.2475 },
            { atMs: 5880, coefficient: 0.2475 },
            { atMs: 6080, coefficient: 0.2475 },
            { atMs: 6400, coefficient: 0.2475 },
            { atMs: 6480, coefficient: 0.2475 },
            { atMs: 6760, coefficient: 0.2475 },
            { atMs: 7280, coefficient: 0.2475 },
            { atMs: 7400, coefficient: 0.2475 },
            { atMs: 8040, coefficient: 0.2475 },
            { atMs: 8080, coefficient: 0.2475 },
            { atMs: 8880, coefficient: 0.2475 },
            { atMs: 9680, coefficient: 0.2475 }
          ],
          [
            { atMs: 880, coefficient: 0.78375 },
            { atMs: 4880, coefficient: 0.2475 }
          ]
        ].flatMap((ticks) => [
          strikeTimeline(ticks, {
            timingAnchor: 'castStart',
            timingScale: 'cast',
            persistsAfterInterrupt: true
          }),
          conditionTimeline(
            ticks.map(({ atMs }) => ({
              atMs,
              condition: CONDITION.VULNERABILITY,
              stacks: 2,
              duration: 8
            })),
            {
              timingAnchor: 'castStart',
              timingScale: 'cast',
              persistsAfterInterrupt: true
            }
          )
        ]),
        // The single-packet layer shares an impact without splitting the earlier multi-packet layers.
        ...impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
          { type: 'strike', coefficient: 0.7425 },
          { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 2, duration: 8 }
        ])
      ]
    },
    20
  ),
  // Earth (Sandstorm) trades damage for control: a near-zero strike coefficient plus eleven
  // one-second blind applications expressed as a single repeating packet.
  [ID.GLYPH_OF_STORMS_EARTH]: {
    name: 'Glyph of Storms (Earth)',
    icon: 'https://render.guildwars2.com/file/53207A9159611359DD9E4001F530F63CA7627FAD/103393.png',
    loadoutSkillId: ID.GLYPH_OF_STORMS,
    slotSelectable: false,
    displayName: 'Glyph of Storms',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',

    cooldown: 40,
    skillFamily: 'Glyph',
    castTimeMs: 1120,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880].map((atMs) => ({
          atMs,
          coefficient: 0.045454545454545456,
          damageKind: 'field-tick'
        }))
      },
      {
        type: 'condition',
        ticks: [880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880].map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 3
        }))
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        atMs: 880,
        applications: 11,
        intervalMs: 1000
      }
    ])
  },
  // --- Signets ------------------------------------------------------------------
  // Active effects are authored here; the attribute modifier reads recharge for Signet of Fire's passive precision.
  [ID.SIGNET_OF_FIRE]: {
    name: 'Signet of Fire',
    icon: 'https://render.guildwars2.com/file/78F000A3121FCFF9B56EA62625186F0E06D8A458/103340.png',
    // Readiness and Written in Stone gate this skill-owned passive precision bonus.
    attributeBonuses: { precision: 180 },
    type: 'Utility',
    slot: 'Utility',

    cooldown: 12,
    skillFamily: 'Signet',
    castTimeMs: 520,
    // The active commits at 480 ms; earlier interruptions cancel its effects.
    interruptCommitMs: 480,
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 10
      }
    ])
  },
  [ID.SIGNET_OF_EARTH]: {
    name: 'Signet of Earth',
    icon: 'https://render.guildwars2.com/file/DC27E04D9F9CE5627D953752B5F334C7A304B7F5/103352.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 15,
    skillFamily: 'Signet',
    castTimeMs: 520,
    // The active commits at 480 ms; earlier interruptions cancel its effects.
    interruptCommitMs: 480,
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 4, duration: 9 },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }
    ])
  },
  // --- Elites --------------------------------------------------------------------
  // Unlike the utility conjures this one also strikes, and its hit lands after the cast ends.
  [ID.CONJURE_FIERY_GREATSWORD]: {
    name: 'Conjure Fiery Greatsword',
    icon: 'https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png',
    // The equipped bundle and its ground copy share this skill-owned lifetime.
    duration: 30,
    // Wielding the conjure grants these attributes, including when acquiring its ground copy.
    attributeBonuses: { conditionDamage: 180, power: 260 },
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    type: 'Elite',
    slot: 'Elite',

    cooldown: 180,
    skillFamily: 'Conjure',
    castTimeMs: 1160,
    effects: impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 3 }
    ]),
    // Equip this bundle and create its one-use ground copy on commitment, then emit the weapon-swap event.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.equip-conjure' } }]
  },
  // The two Glyph of Elementals variants (Fire / Earth) share the elite slot and produce no
  // packets themselves. Their player activation uses the effective cast duration. The companion subsystem in
  // core/mechanics/elementals/ owns the summon's lifetime, attack loop, and post-expiry recharge;
  // it also blocks a recast while the elemental is alive and re-arms the cooldown on expiry.
  [ID.GLYPH_OF_ELEMENTALS]: {
    name: 'Glyph of Elementals',
    icon: 'https://render.guildwars2.com/file/011D983FEAFB946EF0F45E7F290838CFA31D63D0/103380.png',
    loadoutSkillId: 5666,
    // Companion lifecycle tuning is independent of the glyph's activation cooldown.
    duration: 120,
    rechargeAfterExpiry: 40,
    summonStartupDelay: 0.16,
    // This simulator projection always summons Fire, independent of the current attunement.
    displayName: 'Glyph of Elementals (Fire)',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 190,
    skillFamily: 'Glyph',
    castTimeMs: 840,
    effects: [],
    // Summon on commitment; the companion owns its attacks, command flip, lifetime, and held recharge.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.summon-elemental' } }]
  },
  [ID.GLYPH_OF_ELEMENTALS_EARTH]: {
    name: 'Glyph of Elementals (Earth)',
    // This simulator projection always summons Earth, independent of the current attunement.
    icon: 'https://render.guildwars2.com/file/011D983FEAFB946EF0F45E7F290838CFA31D63D0/103380.png',
    loadoutSkillId: 5666,
    // Companion lifecycle tuning is independent of the glyph's activation cooldown.
    duration: 120,
    rechargeAfterExpiry: 40,
    summonStartupDelay: 0.16,
    type: 'Elite',
    slot: 'Elite',

    cooldown: 190,
    skillFamily: 'Glyph',
    castTimeMs: 840,
    effects: [],
    // Summon on commitment; the companion owns its attacks, command flip, lifetime, and held recharge.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.summon-elemental' } }]
  },
  // --- Cantrips ---------------------------------------------------------------
  // Instant cast; only the offensive burn and the self Might are modelled (the condition
  // cleanse it is named for has no damage-model effect).
  [ID.CLEANSING_FIRE]: {
    name: 'Cleansing Fire',
    icon: 'https://render.guildwars2.com/file/2FBB046640434531443F7920CFF205A2787932E3/103336.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    skillFamily: 'Cantrip',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 6
      },
      { type: 'boon', boon: BOON.MIGHT, stacks: 3, duration: 9 }
    ])
  }
};
