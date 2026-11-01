/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer hammer skill timing, damage, control, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.POSITIVE_STRIKE]: {
    name: 'Positive Strike',
    description: 'Chain. Smack your hammer into your foe while empowering yourself.',
    icon: 'https://render.guildwars2.com/file/03AFAF0818322FBFBA7D0A03A313B7C1F9B224C2/1128586.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Positive Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1
      }
    ])
  },
  [ID.NEGATIVE_BASH]: {
    name: 'Negative Bash',
    description: 'Chain. Slam your hammer into your foe to leave them vulnerable.',
    icon: 'https://render.guildwars2.com/file/99F8097EDF3414100FDC21697C0A30BB31B6A605/1128585.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 640,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Negative Bash',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.EQUALIZING_BLOW]: {
    name: 'Equalizing Blow',
    description: 'Chain. Bring down your hammer on your foe.',
    icon: 'https://render.guildwars2.com/file/7D9690A6720204571801256DC30BF6B4BFEDE524/1058589.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    castTimeMs: 440,
    // A kit swap after the final attack packet still commits Equalizing Blow's effects.
    interruptCommitMs: 400,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Equalizing Blow',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 3
      }
    ])
  },
  [ID.ELECTRO_WHIRL]: {
    name: 'Electro-whirl',
    description: 'Spin around, reflecting missiles and hitting enemies.',
    icon: 'https://render.guildwars2.com/file/B36C6EBE3577BAA5773857EDE33895C5C6663EEC/1058590.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    effects: [
      {
        type: 'strike',
        // Both strikes land before cast recovery ends, matching the observed quickened hit offsets.
        ticks: [280, 640].map((atMs) => ({ atMs, coefficient: 3 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Electro-whirl',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.ROCKET_CHARGE]: {
    name: 'Rocket Charge',
    description: 'Dash forward with a rocket-charged hammer to damage enemies.',
    icon: 'https://render.guildwars2.com/file/AE3AF2E525F00F645EEAA97143E322E519DA1569/1058592.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 1920,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 640, coefficient: 1.2 },
          { atMs: 1240, coefficient: 1.2 },
          { atMs: 1920, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rocket Charge',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.SHOCK_SHIELD]: {
    name: 'Shock Shield',
    description: 'Block attacks while striking foes in front of you, gaining barrier with each enemy you hit.',
    icon: 'https://render.guildwars2.com/file/28DD470E607DA1BB687BD0956C6DEE665CBAFCCE/1058591.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 18,
    castTimeMs: 1200,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 240 + index * 240, coefficient: 1.25 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Shock Shield',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    name: 'Thunderclap',
    description: 'Ionize an area, bringing down the power of lightning to stun foes and damage them over its duration.',
    icon: 'https://render.guildwars2.com/file/21C770525B9B9BEDB7BBFF24055E1138C333FC00/1058593.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 4 / 5 })),
          name: 'Thunderclap',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: 1000 + index * 1000,
            condition: CONDITION.VULNERABILITY,
            stacks: 1,
            duration: 8
          })),
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: CONTROL.STUN
      }
    ]
  }
});
