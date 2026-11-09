/**
 * Owns Evoker familiar basic and empowered skill definitions.
 * Declares patchable effects and the familiar lifecycle actions that own acceptance and settlement.
 */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { acceptIgniteEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import type { ElementalistModifierContext, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Complete Evoker familiar definitions with explicit activation behavior.
 *
 * The eight familiar skills form four basic/empowered pairs declared in
 * `skill-flips.ts`. Definitions declare their start and commit behavior; gating uses
 * charge/empowered state in the familiar lifecycle, not the `cooldown: 0`
 * declared here.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_FAMILIAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.IGNITE]: {
    name: 'Ignite',
    icon: 'https://render.guildwars2.com/file/3C20D2FF75DA624828651AD5CEB463AC90A01207/3680117.png',
    tierResetDuration: 15,
    empoweredUnlockDelay: 0.96,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.4,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.63 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
    ]),
    // Acceptance advances the Burning tier once and selects that tier's packet for this cast.
    effectVariants: [{ when: () => true, transform: acceptIgniteEffects }],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'elementalist.evoker.begin-familiar',
          id: 'burning-tiers',
          // Duration templates are selected at acceptance, never emitted by the lifecycle action.
          effects: [
            { type: 'condition', name: 'Tier 1', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
            { type: 'condition', name: 'Tier 2', condition: CONDITION.BURNING, stacks: 1, duration: 0.5 },
            { type: 'condition', name: 'Tier 3', condition: CONDITION.BURNING, stacks: 1, duration: 1 },
            { type: 'condition', name: 'Tier 4', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.CONFLAGRATION]: {
    name: 'Conflagration',
    icon: 'https://render.guildwars2.com/file/D20BEA0141B9C458045D0C77C8CF5C16151B3C5F/3680115.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    // A released Conflagration survives cutting the command animation short.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.56 },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 2,
          duration: 4.5
        }
      ]
    ),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.SPLASH]: {
    name: 'Splash',
    icon: 'https://render.guildwars2.com/file/2C4C57C5B721422A66D3CEAB4ACE753E4FE69355/3680119.png',
    empoweredUnlockDelay: 0.84,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.4,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.BUOYANT_DELUGE]: {
    name: 'Buoyant Deluge',
    icon: 'https://render.guildwars2.com/file/80B7BBD01BFF65A4E29307D59079EF9875119924/3680116.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'control',
        atMs: 2200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: CONTROL.STUN
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.ZAP]: {
    name: 'Zap',
    icon: 'https://render.guildwars2.com/file/234FFB056E376AEE0D6D150A3C23C669BEC0359A/3680120.png',
    empoweredUnlockDelay: 0.68,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.3,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    // The Air familiar buff increases outgoing strikes throughout its active window.
    modifiers: [
      {
        id: 'elementalist.zap',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.03,
        when: (context: ElementalistModifierContext) =>
          context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'zap buff', 1) > 0
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.zap',
          id: 'zap-window',
          effects: [{ type: 'buff', name: 'Zap Window', kind: 'zap buff', stacks: 1, duration: 5 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.LIGHTNING_BLITZ]: {
    name: 'Lightning Blitz',
    icon: 'https://render.guildwars2.com/file/CF99A0354E3667FDE3702CAEA4C3B6AFB2D6ACFD/3680113.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, coefficient: 0.28 }))
      },
      {
        type: 'condition',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({
          atMs,
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 3
        }))
      }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.evoker.lightning-blitz',
          id: 'electric-enchantment',
          // Keep this charge batch independent of Hare's Agility and trait-granted enchantments.
          effects: [{ type: 'buff', name: 'Lightning Blitz Enchantment', stacks: 1, duration: 6 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  },
  [ID.CALCIFY]: {
    name: 'Calcify',
    icon: 'https://render.guildwars2.com/file/C938A2442A5508F415AB72F70AA9A85AFA57FCDD/3680114.png',
    internalCooldown: 0.25,
    empoweredUnlockDelay: 0.28,
    // A basic cast within this start-to-start window cancels the preceding empowered activation.
    duration: 2.2,
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'elementalist.evoker.begin-familiar',
          id: 'protection',
          // Equipped Earth passively grants Protection on disables; casting does not emit this payload.
          effects: [
            {
              type: 'boon',
              name: BOON.PROTECTION,
              boon: BOON.PROTECTION,
              stacks: 1,
              duration: 2,
              audience: { recipients: RECIPIENT.SELF }
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ]
  },
  [ID.SEISMIC_IMPACT]: {
    name: 'Seismic Impact',
    icon: 'https://render.guildwars2.com/file/026020B3C3EF9AC03DF8C352E91299562573FCCA/3680118.png',
    type: 'Profession',
    slot: 'Profession_5',
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Familiar',
    castTimeMs: 360,
    effects: impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.15,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 6, duration: 10 },
      // The initial knockdown triggers disable passives before the later damage and barrier pulses.
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKDOWN, atMs: 1320 },
      // The barrier supplies party Protection independently of hitting an enemy; its pulses keep a fixed cadence.
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 1.5,
        applications: 5,
        atMs: 2320,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]),
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ]
  }
};
