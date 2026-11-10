import { BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.CORE_CLEAVE]: {
    name: 'Core Cleave',
    icon: 'https://render.guildwars2.com/file/B6900CCBA53BD1189D0E09C10C43AB08AE64016B/1770455.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 600].map((atMs) => ({ atMs, coefficient: 0.36 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 600, condition: CONDITION.BLEEDING, stacks: 2, duration: 2.5 }]
      }
    ])
  },
  [ID.BLEEDING_EDGE]: {
    name: 'Bleeding Edge',
    icon: 'https://render.guildwars2.com/file/490E143D431FCBDC9BD7E60ED875F5710DBEE43F/1770456.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    interruptCommitMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [480, 640].map((atMs) => ({ atMs, coefficient: 0.36 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: CONDITION.BLEEDING, stacks: 2, duration: 2.5 }]
      }
    ])
  },
  [ID.SEARING_SLASH]: {
    name: 'Searing Slash',
    icon: 'https://render.guildwars2.com/file/6D161191B16102166A94D41FF6F0DBF206F3A77C/1770457.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [480, 640].map((atMs) => ({ atMs, coefficient: 1.2 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: CONDITION.BURNING, stacks: 2, duration: 2.5 }]
      }
    ])
  },
  [ID.SYMBOL_OF_VENGEANCE]: {
    name: 'Symbol of Vengeance',
    icon: 'https://render.guildwars2.com/file/D7DDD899551C060AB9B2C2B0BDC71A6194E379EF/1770458.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',

    cooldown: 8,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 800,
    interruptCommitMs: 760,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 680, startAnchor: 'castStart' }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          metadata: { guardianSymbol: true },
          coefficient: 0.6,
          atMs: 680,
          applications: 5,
          intervalMs: 1000
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 5,
          atMs: 680,
          applications: 5,
          intervalMs: 1000
        }
      ]),
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 1.5
      },
      // Later symbol pulses repeat Fury at their fixed offsets after the initial application.
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 1.5,
        atMs: 1680,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.BLAZING_EDGE]: {
    name: 'Blazing Edge',
    icon: 'https://render.guildwars2.com/file/B254F2279C5C1E9E6E3AAE11B97D460E0F3E45E0/1770459.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 520,
    // Share the strike and Burning impact while the pull retains cast-completion timing.
    effects: [
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.8
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 5
        }
      ]),
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ]
  }
};
