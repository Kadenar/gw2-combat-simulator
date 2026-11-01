import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { triggeredVirtueEffects } from '#gw2/professions/guardian/core/skills/virtue-payloads.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

// The field and its pulses share an application time independent of the cast's page payment.
const scorchedAftermathApplicationMs = 440;

/**
 * Owns Firebrand tome and tome-page skill definitions.
 * Persistent tome page state and behavior remain under `mechanics/`.
 */

/** Tome and trait grants consume one shared triggered Burning skill, independent of their charge windows. */
export const ashesBurningSkill: Skill = {
  name: 'Ashes of the Just: Burning per charge',
  description: 'Automatically triggered Ashes of the Just: Burning per charge effect.',
  icon: new URL('@images/wiki/epilogue-ashes-of-the-just.png', import.meta.url).href,
  // Match the emitted source so observed damage identifies this skill in patch notes.
  id: 'guardian.ashes-of-the-just',
  type: 'Proc',
  simulatorExcluded: true,
  internalCooldown: 1,
  effects: [
    {
      type: 'condition',
      name: CONDITION.BURNING,
      condition: CONDITION.BURNING,
      stacks: 1,
      duration: 2,
      actorType: ACTOR.PLAYER
    }
  ]
};

export const FIREBRAND_TOME_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SEARING_SPELL]: {
    name: 'Chapter 1: Searing Spell',
    description: 'Tome. Incite a swelling of heat, damaging and burning foes in front of you.',
    icon: new URL('@images/wiki/chapter-1-searing-spell.png', import.meta.url).href,
    tome: 'justice',
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 680,
    // A cancel after commitment retains the completed page use and its effects.
    interruptCommitMs: 480,
    // Keep the committed page's strike and conditions on one impact.
    effects: impactEffects(
      { atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          weaponStrengthProfileId: 'bundle.exotic',
          type: 'strike',
          coefficient: 0.95
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2.5
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 2,
          duration: 10
        }
      ]
    )
  },
  [ID.IGNITING_BURST]: {
    name: 'Chapter 2: Igniting Burst',
    description: 'Tome. Ignite nearby foes and weaken them.',
    icon: new URL('@images/wiki/chapter-2-igniting-burst.png', import.meta.url).href,
    tome: 'justice',
    type: 'Bundle',
    slot: 'Weapon_2',
    cooldown: 8,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 480,
    // Keep the page's strike, Burning, and Weakness on one impact.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        coefficient: 0.55
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.HEATED_REBUKE]: {
    name: 'Chapter 3: Heated Rebuke',
    description: 'Tome. Pull nearby enemies toward you with a heated rebuke.',
    icon: new URL('@images/wiki/chapter-3-heated-rebuke.png', import.meta.url).href,
    tome: 'justice',
    type: 'Bundle',
    slot: 'Weapon_3',
    cooldown: 10,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ]
  },
  [ID.SCORCHED_AFTERMATH]: {
    name: 'Chapter 4: Scorched Aftermath',
    description: 'Tome. Create a pulsing fire field that burns and bleeds enemies.',
    icon: new URL('@images/wiki/chapter-4-scorched-aftermath.png', import.meta.url).href,
    tome: 'justice',
    type: 'Bundle',
    slot: 'Weapon_4',
    cooldown: 15,
    // Debit on commitment before the earned Swift Scholar refund, like the other tome skills.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 920,
    // The Fire combo field lasts four seconds from the first pulse.
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startMs: scorchedAftermathApplicationMs,
        startAnchor: 'castStart'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        ticks: [0, 1000, 2000, 3000, 4000].map((offsetMs) => ({
          atMs: scorchedAftermathApplicationMs + offsetMs,
          coefficient: 0.64
        }))
      },
      // Each pulse applies both conditions, retaining their separate durations and packet order.
      ...(
        [
          { condition: CONDITION.BURNING, duration: 3 },
          { condition: CONDITION.BLEEDING, duration: 5 }
        ] as const
      ).flatMap(({ condition, duration }) =>
        [0, 1000, 2000, 3000, 4000].map((offsetMs) => ({
          type: 'condition' as const,
          ticks: [{ atMs: scorchedAftermathApplicationMs + offsetMs, condition, stacks: 1, duration }]
        }))
      )
    ])
  },
  [ID.ASHES_OF_THE_JUST]: {
    name: 'Epilogue: Ashes of the Just',
    description: 'Tome. Your next attacks inflict burning on their targets.',
    icon: new URL('@images/wiki/epilogue-ashes-of-the-just.png', import.meta.url).href,
    tome: 'justice',
    type: 'Bundle',
    slot: 'Weapon_5',
    cooldown: 20,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 880,
    // A committed cancellation preserves the separately scheduled Ashes grant.
    interruptCommitMs: 640,
    effects: [],
    // Accepted casts schedule the party grant at its application boundary during the animation.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'guardian.start-ashes',
          id: 'grant',
          effects: [
            {
              type: 'buff',
              name: 'ashes-of-the-just',
              kind: 'ashes-of-the-just',
              stacks: 2,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              type: 'boon',
              name: 'might',
              boon: BOON.MIGHT,
              stacks: 8,
              duration: 10,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.STOW_TOME]: {
    name: 'Stow Tome',
    description: 'Stow your tome.',
    icon: 'https://render.guildwars2.com/file/7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    // Custom: Closes the active tome and updates tome state; see `firebrand/mechanics/tomes.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    effects: [],
    // Stow closes the bar and ends its Swift Scholar session.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.stow-tome' } }]
  },
  [ID.TOME_OF_RESOLVE]: {
    name: 'Tome of Resolve',
    description:
      'Virtue: Regenerate health.\nActivate: Draw forth an enchanted tome that recounts the trials undergone by the people of Vabbi.',
    icon: 'https://render.guildwars2.com/file/E206770FD62BB63B71F56209F34BF99392BADF9E/1770478.png',
    type: 'Profession',
    slot: 'Profession_2',
    virtue: 'resolve',
    cooldown: 0,
    dormantCooldown: 30,
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    castTimeMs: 0,
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    effects: [],
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-resolve' } }]
  },
  [ID.DESERT_BLOOM]: {
    name: 'Chapter 1: Desert Bloom',
    description: 'Tome. Tales of desert blooms create a wave of healing for your allies.',
    icon: new URL('@images/wiki/chapter-1-desert-bloom.png', import.meta.url).href,
    tome: 'resolve',
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.RADIANT_RECOVERY]: {
    name: 'Chapter 2: Radiant Recovery',
    description:
      'Tome. Release magic from pages detailing the rebuilding of Vabbi, cleansing conditions on nearby allies. Allies are healed for each condition removed.',
    icon: new URL('@images/wiki/chapter-2-radiant-recovery.png', import.meta.url).href,
    tome: 'resolve',
    type: 'Bundle',
    slot: 'Weapon_2',
    cooldown: 4,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.AZURE_SUN]: {
    name: 'Chapter 3: Azure Sun',
    description:
      'Tome. Inspired by countless poems describing the comforting powers of the water-reflected sun, grant boons to allies.',
    icon: new URL('@images/wiki/chapter-3-azure-sun.png', import.meta.url).href,
    tome: 'resolve',
    type: 'Bundle',
    slot: 'Weapon_3',
    cooldown: 8,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 6
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5
      }
    ]
  },
  [ID.TOME_OF_COURAGE]: {
    name: 'Tome of Courage',
    description:
      'Virtue: Gain aegis periodically. \nActivate: Conjure a mystic tome containing stories about the heroes of Istan.',
    icon: 'https://render.guildwars2.com/file/49B3D2E829962602205B09619770E1650BF07108/1770466.png',
    type: 'Profession',
    slot: 'Profession_3',
    virtue: 'courage',
    cooldown: 0,
    dormantCooldown: 45,
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    passiveInterval: 40,
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'boon',
        name: 'aegis',
        boon: BOON.AEGIS,
        stacks: 1,
        duration: 40,
        metadata: {
          trigger: 'virtue'
        }
      }
    ],
    effectVariants: [triggeredVirtueEffects],
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-courage' } }]
  },
  [ID.SHINING_RIVER]: {
    name: 'Chapter 4: Shining River',
    description:
      'Tome. Release a torrent of pages describing the water cycle of the Elon River. Heal allies and grant them swiftness.',
    icon: new URL('@images/wiki/chapter-4-shining-river.png', import.meta.url).href,
    tome: 'resolve',
    type: 'Bundle',
    slot: 'Weapon_4',
    cooldown: 10,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        atMs: 1240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        atMs: 2240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 5,
        atMs: 4240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ETERNAL_OASIS]: {
    name: 'Epilogue: Eternal Oasis',
    description: 'Tome. Convert conditions to boons and increase incoming healing.',
    icon: new URL('@images/wiki/epilogue-eternal-oasis.png', import.meta.url).href,
    tome: 'resolve',
    type: 'Bundle',
    slot: 'Weapon_5',
    cooldown: 20,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 2,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.UNFLINCHING_CHARGE]: {
    name: 'Chapter 1: Unflinching Charge',
    description: 'Tome. Grant swiftness and protection to nearby allies.',
    icon: new URL('@images/wiki/chapter-1-unflinching-charge.png', import.meta.url).href,
    tome: 'courage',
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 2
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 6
      }
    ]
  },
  [ID.DARING_CHALLENGE]: {
    name: 'Chapter 2: Daring Challenge',
    description: 'Tome. Taunt nearby enemies and grant resolution to allies.',
    icon: new URL('@images/wiki/chapter-2-daring-challenge.png', import.meta.url).href,
    tome: 'courage',
    type: 'Bundle',
    slot: 'Weapon_2',
    cooldown: 4,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.TAUNT
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 3
      }
    ]
  },
  [ID.TOME_OF_JUSTICE]: {
    name: 'Tome of Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: Pull forth a magical tome on the dangers of the blazing heat in Kourna.',
    icon: 'https://render.guildwars2.com/file/2710AF269B38A4A365089BC7B3C9389B354DE59D/1770472.png',
    type: 'Profession',
    slot: 'Profession_1',
    virtue: 'justice',
    cooldown: 0,
    dormantCooldown: 20,
    inputCategory: 'bar-swap',
    // Explicit weapon or profession bar replacement.
    castTimeMs: 0,
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    effects: [],
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-justice' } }]
  },
  [ID.VALIANT_BULWARK]: {
    name: 'Chapter 3: Valiant Bulwark',
    description: 'Tome. Create a reflective barrier at the target area.',
    icon: new URL('@images/wiki/chapter-3-valiant-bulwark.png', import.meta.url).href,
    tome: 'courage',
    type: 'Bundle',
    slot: 'Weapon_3',
    cooldown: 15,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.STALWART_STAND]: {
    name: 'Chapter 4: Stalwart Stand',
    description: 'Tome. Create a light field that grants resistance and breaks stun.',
    icon: new URL('@images/wiki/chapter-4-stalwart-stand.png', import.meta.url).href,
    tome: 'courage',
    type: 'Bundle',
    slot: 'Weapon_4',
    cooldown: 20,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 1,
        atMs: 1240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 1,
        atMs: 2240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 1,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.UNBROKEN_LINES]: {
    name: 'Epilogue: Unbroken Lines',
    description: 'Tome. Grant protection, stability, aegis, and toughness to allies.',
    icon: new URL('@images/wiki/epilogue-unbroken-lines.png', import.meta.url).href,
    tome: 'courage',
    type: 'Bundle',
    slot: 'Weapon_5',
    cooldown: 25,
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 2,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'buff',
        kind: 'toughness',
        duration: 5,
        stacks: 300
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 4
      }
    ]
  }
});
