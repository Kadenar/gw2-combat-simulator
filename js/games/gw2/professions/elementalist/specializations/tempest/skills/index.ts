/**
 * Owns Tempest overload and slot-skill catalog fragments only.
 * Persistent overload and aura behavior lives under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { TEMPEST_OVERLOAD_EFFECTS } from '#gw2/professions/elementalist/specializations/tempest/skills/overload-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/**
 * Catalog fragments Tempest owns: the four overloads and the damaging shouts.
 *
 * Overloads are `overload: true` profession skills bound to one attunement, recharge from cast end,
 * and take their tick effects from TEMPEST_OVERLOAD_EFFECTS; the gating, aura, and trait behavior
 * lives in mechanics/overloads.ts. Shouts use the native completion owner
 * and declare their self-aura as `element|seconds`, which the core cast pipeline applies for them.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const TEMPEST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.OVERLOAD_FIRE]: {
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
        fieldType: 'Fire',
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
    name: 'Overload Air',
    type: 'Profession',
    slot: 'Profession_3',
    specialization: 'Tempest',
    attunement: 'Air',
    mechanicSlot: 3,
    categories: ['Attunement'],
    castTimeMs: 3200,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
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
    aura: 'Fire|4',
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5 },
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 2 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 4,
        metadata: {}
      })),
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 8,
        duration: 15,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        metadata: {}
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
    aura: 'Magnetic|4',
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: [
      ...impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: 'Cripple', stacks: 1, duration: 6, metadata: {} },
        { type: 'boon', boon: 'Protection', stacks: 1, duration: 5, metadata: {} },
        { type: 'boon', boon: 'Aegis', stacks: 1, duration: 5, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1200, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.75,
          comboFinishers: [
            {
              attemptGroup: 'effect:5:tick:1',
              ownerId: 'elementalist',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        { type: 'condition', condition: 'Immobilize', stacks: 1, duration: 2, metadata: {} }
      ])
    ]
  }
});
