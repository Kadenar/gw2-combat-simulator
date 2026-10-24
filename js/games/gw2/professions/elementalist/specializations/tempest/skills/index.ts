import { AURA, COMBO_FIELD, RECIPIENT, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
/**
 * Owns Tempest overload and slot-skill catalog fragments only.
 * Persistent overload behavior lives in `hooks.ts`; aura reactions live under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { TEMPEST_OVERLOAD_EFFECTS } from '#gw2/professions/elementalist/specializations/tempest/skills/overload-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * Catalog fragments Tempest owns: the four overloads and the damaging shouts.
 *
 * Overloads are `overload: true` profession skills bound to one attunement, recharge from cast end,
 * and take their tick effects from TEMPEST_OVERLOAD_EFFECTS; the gating, aura, and trait behavior
 * lives in hooks.ts. Shouts use the native completion owner
 * and declare their self-aura as `element|seconds`, which the core cast pipeline applies for them.
 * The engine dispatches castCommit only after the skill's commit cutoff, so overload rewards need no second check.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const TEMPEST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.OVERLOAD_FIRE]: {
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      },
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.etching-credits' }
      }
    ],
    name: 'Overload Fire',
    type: 'Profession',
    slot: 'Profession_1',
    specialization: 'Tempest',
    attunement: 'Fire',
    mechanicSlot: 1,
    categories: ['Attunement'],
    castTimeMs: 3320,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 9,
        startAnchor: 'castEnd'
      }
    ],
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_FIRE]
  },
  // Overload Water is modeled for its cast time, recharge, and trait triggers only: its healing
  // pulses carry no simulated damage, condition, or boon packets.
  [ID.OVERLOAD_WATER]: {
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      }
    ],
    name: 'Overload Water',
    type: 'Profession',
    slot: 'Profession_2',
    specialization: 'Tempest',
    attunement: 'Water',
    mechanicSlot: 2,
    categories: ['Attunement'],
    castTimeMs: 2920,
    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_WATER]
  },
  [ID.OVERLOAD_AIR]: {
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      },
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.lightning-jolt' }
      },
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.etching-credits' }
      }
    ],
    name: 'Overload Air',
    type: 'Profession',
    slot: 'Profession_3',
    specialization: 'Tempest',
    attunement: 'Air',
    mechanicSlot: 3,
    categories: ['Attunement'],
    castTimeMs: 3200,
    // The channel commits before the remaining aftercast, retaining the storm and completion rewards.
    interruptCommitMs: 3140,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_AIR]
  },
  [ID.OVERLOAD_EARTH]: {
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      },
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.etching-credits' }
      }
    ],
    name: 'Overload Earth',
    type: 'Profession',
    slot: 'Profession_4',
    specialization: 'Tempest',
    attunement: 'Earth',
    mechanicSlot: 4,
    categories: ['Attunement'],
    castTimeMs: 2760,
    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_EARTH]
  },
  [ID.WASH_THE_PAIN_AWAY]: {
    name: 'Wash the Pain Away!',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Tempest',
    categories: ['Shout'],
    castTimeMs: 1040,
    cooldown: 20,
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: []
  },
  [ID.FEEL_THE_BURN]: {
    name: 'Feel the Burn!',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Tempest',
    categories: ['Shout'],
    castTimeMs: 0,
    cooldown: 25,
    aura: { kind: AURA.FIRE, duration: 4 },
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 4
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        stacks: 1,
        duration: 10,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 8,
        duration: 15,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ])
  },
  [ID.AFTERSHOCK]: {
    name: 'Aftershock!',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Tempest',
    categories: ['Shout'],
    castTimeMs: 0,
    cooldown: 30,
    aura: { kind: AURA.MAGNETIC, duration: 4 },
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: [
      ...impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 6 },
        {
          type: 'boon',
          boon: BOON.PROTECTION,
          // Share this support boon with affected allies within its recipient cap.
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          stacks: 1,
          duration: 5
        },
        {
          type: 'boon',
          boon: BOON.AEGIS,
          // Share this support boon with affected allies within its recipient cap.
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          stacks: 1,
          duration: 5
        }
      ]),
      ...impactEffects({ atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.75,
          comboFinishers: [
            {
              attemptGroup: 'effect:5:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
      ])
    ]
  }
});
