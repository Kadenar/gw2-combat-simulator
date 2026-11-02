/** Rifle packets use close-range cast-start offsets so projectile travel does not inflate their timing. */
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.FIERCE_SHOT]: {
    name: 'Fierce Shot',
    icon: 'https://render.guildwars2.com/file/FBBFE42D0BD0745F56BF30483240E67F0994562C/103254.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    // Rifle projectile finishers stay declarative so each emitted shot uses the shared combo scheduler.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1
      }
    ])
  },
  [ID.VOLLEY]: {
    name: 'Volley',
    icon: 'https://render.guildwars2.com/file/97A0DA3D06ABFDE4CFEF0EE02EC4B46DF6F17271/103249.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',
    cooldown: 10,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 1760,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        type: 'strike',
        // The fifth close-range packet is inferred from the complete, more distant cast.
        ticks: [
          { atMs: 440, coefficient: 0.8 },
          { atMs: 720, coefficient: 0.8 },
          { atMs: 1000, coefficient: 0.8 },
          { atMs: 1320, coefficient: 0.8 },
          { atMs: 1600, coefficient: 0.8 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.EXPLOSIVE_SHELL]: {
    name: 'Explosive Shell',
    icon: 'https://render.guildwars2.com/file/B65AC760EC9D4FAC6D701694BB9B3A3FC9D134AC/2440723.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    cooldown: 8,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 560,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 10
      }
    ])
  },
  [ID.BRUTAL_SHOT]: {
    name: 'Brutal Shot',
    icon: 'https://render.guildwars2.com/file/E07AB4BA685E11A6BEAFC9540308CD0DD1C23B6C/103248.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',
    cooldown: 20,
    ammoCastLockout: 1,
    ammo: 2,

    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 500,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 1
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 12
      }
    ]
  },
  [ID.RIFLE_BUTT]: {
    name: 'Rifle Butt',
    icon: 'https://render.guildwars2.com/file/77FCEC0F1833249C540D5B321E3BA4017872ABCB/102766.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    // Rifle Butt uses its successful-hit recharge and reloads the rest of the rifle kit on completion.
    cooldown: 12,
    castTimeMs: 480,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ]),
    // Completed strikes restock the live rifle catalog and reset its bursts.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.rifle-restock' } }]
  }
};
