/**
 * Owns Tempest overload and slot-skill catalog definitions only.
 * Persistent overload behavior lives in `hooks.ts`; aura reactions live under `mechanics/`.
 */
import { AURA, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_OVERLOAD_EFFECTS } from '#gw2/professions/elementalist/specializations/tempest/skills/overload-effects.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Catalog definitions Tempest owns: the four overloads and the damaging shouts.
 *
 * Overloads are `overload: true` profession skills bound to one attunement, recharge from cast end,
 * and take their tick effects from TEMPEST_OVERLOAD_EFFECTS; the gating, aura, and trait behavior
 * lives in hooks.ts. Shouts declare standard aura effects before their hostile packets so
 * aura-triggered rewards can affect the granting skill.
 * The engine dispatches castCommit only after the skill's commit cutoff, so overload rewards need no second check.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const TEMPEST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.OVERLOAD_FIRE]: {
    name: 'Overload Fire',
    icon: 'https://render.guildwars2.com/file/3A04F5D420A86664A3044B950E145E022A49D8AA/1029985.png',
    type: 'Profession',
    slot: 'Profession_1',
    attunement: 'Fire',

    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    castTimeMs: 3320,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        // Cover the channel's own whirl finishers and the five-second lingering tornado.
        duration: 8.32,
        startAnchor: 'castStart'
      }
    ],
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_FIRE],
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
    ]
  },
  // Overload Water is modeled for its cast time, recharge, and trait triggers only: its healing
  // pulses carry no simulated damage, condition, or boon packets.
  [ID.OVERLOAD_WATER]: {
    name: 'Overload Water',
    icon: 'https://render.guildwars2.com/file/0E3DEF200ACD40FE281956CBA511E934F2B3F82A/1029986.png',
    type: 'Profession',
    slot: 'Profession_2',
    attunement: 'Water',

    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    castTimeMs: 2920,
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_WATER],
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      }
    ]
  },
  [ID.OVERLOAD_AIR]: {
    name: 'Overload Air',
    icon: 'https://render.guildwars2.com/file/592CC2A120322000BC7234B8522BBE7BAF2F4A57/1029987.png',
    type: 'Profession',
    slot: 'Profession_3',
    attunement: 'Air',

    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    castTimeMs: 3200,
    // The channel commits before the remaining aftercast, retaining the storm and completion rewards.
    interruptCommitMs: 3140,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_AIR],
    // Only a completed channel locks its attunement; Air also grants Jolt, and non-Water overloads add two etching credits.
    sideEffects: [
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.overload-lockout' }
      },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.tempest.lightning-jolt',
          id: 'lightning-jolt',
          // Completion and the active elemental's next attack share this selected coefficient.
          effects: [{ name: 'Overload Air - Lightning Jolt', type: 'strike', coefficient: 1.32, hits: 1 }]
        }
      },
      {
        on: 'castCommit',
        do: { type: 'elementalist.tempest.etching-credits' }
      }
    ]
  },
  [ID.OVERLOAD_EARTH]: {
    name: 'Overload Earth',
    icon: 'https://render.guildwars2.com/file/975A1DE89BA70721BD0E0F6D601C259066F8D468/1029988.png',
    type: 'Profession',
    slot: 'Profession_4',
    attunement: 'Earth',

    cooldown: 20,
    rechargeAnchor: 'castEnd',
    overload: true,
    skillFamily: 'Attunement',
    castTimeMs: 2760,
    effects: TEMPEST_OVERLOAD_EFFECTS[ID.OVERLOAD_EARTH],
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
    ]
  },
  [ID.WASH_THE_PAIN_AWAY]: {
    name: 'Wash the Pain Away!',
    icon: 'https://render.guildwars2.com/file/D9939BFEEF613CEE550B5DDA9DF97E58B7BC4F16/1029989.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    skillFamily: 'Shout',
    castTimeMs: 1040,
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: []
  },
  [ID.FEEL_THE_BURN]: {
    name: 'Feel the Burn!',
    icon: 'https://render.guildwars2.com/file/2963BBB55948D8C0C96CCB96B5100D2999C7DF09/1029992.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
    skillFamily: 'Shout',
    castTimeMs: 0,
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'aura', aura: AURA.FIRE, duration: 4 },
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
    icon: 'https://render.guildwars2.com/file/024E50B435ACA9BC350E3A0C5E07F1172D180808/1029991.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 30,
    skillFamily: 'Shout',
    castTimeMs: 0,
    // Custom: Applies Tempest shout trait effects; see `tempest/module.ts`.

    effects: [
      { type: 'aura', aura: AURA.MAGNETIC, duration: 4 },
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
};
