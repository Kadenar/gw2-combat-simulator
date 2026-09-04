/**
 * Owns Tempest overload and slot-skill catalog fragments only.
 * Persistent overload and aura behavior lives under `mechanics/`.
 */
import { TEMPEST_OVERLOAD_EFFECTS } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overload-effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * Catalog fragments Tempest owns: the four overloads and the damaging shouts.
 *
 * Overloads are `overload: true` profession skills bound to one attunement, recharge from cast end,
 * and take their tick effects from TEMPEST_OVERLOAD_EFFECTS; the gating, aura, and trait behavior
 * lives in mechanics/overloads.ts. Shouts route through the 'elementalist.tempest-shout' handler
 * and declare their self-aura as `element|seconds`, which the core cast pipeline applies for them.
 */
export const TEMPEST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.OVERLOAD_FIRE]: {
    name: 'Overload Fire',
    type: 'Profession',
    slot: 'Profession_1',
    specialization: 'Tempest',
    attunement: 'Fire',
    mechanicSlot: 1,
    categories: ['Attunement'],
    quicknessCastTimeMs: 3320,
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
    quicknessCastTimeMs: 2920,
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
    quicknessCastTimeMs: 3200,
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
    quicknessCastTimeMs: 2760,
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
    quicknessCastTimeMs: 1040,
    cooldown: 20,
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.
    handlerId: 'elementalist.tempest-shout',
    effects: []
  },
  [ID.FEEL_THE_BURN]: {
    name: 'Feel the Burn!',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Tempest',
    categories: ['Shout'],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    aura: 'Fire|4',
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.
    handlerId: 'elementalist.tempest-shout',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 2.5
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
            condition: 'Burning',
            stacks: 2,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 8,
        duration: 15,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        metadata: {}
      }
    ]
  },
  [ID.AFTERSHOCK]: {
    name: 'Aftershock!',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Tempest',
    categories: ['Shout'],
    quicknessCastTimeMs: 0,
    cooldown: 30,
    aura: 'Magnetic|4',
    skillFamily: 'Shout',
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.
    handlerId: 'elementalist.tempest-shout',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Cripple',
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
        boon: 'Protection',
        stacks: 1,
        duration: 5,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Aegis',
        stacks: 1,
        duration: 5,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1200,
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
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1200,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
