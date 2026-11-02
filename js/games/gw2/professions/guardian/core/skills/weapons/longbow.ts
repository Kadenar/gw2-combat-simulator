/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { COMBO_FIELD, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

// Packet offsets are the canonical Quickness timings measured from EVTC animation starts.
export const GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.PUNCTURE_SHOT]: {
    name: 'Puncture Shot',
    icon: 'https://render.guildwars2.com/file/080363673FCB09916AF7D035C31327C105EE219E/1012869.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    // The shot has committed by its observed impact; cancelling the remaining animation preserves the projectile.
    interruptCommitMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1 }],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TRUE_SHOT]: {
    name: 'True Shot',
    icon: 'https://render.guildwars2.com/file/0B0A3D5C61D9DD0619FE032E3E752FB5AE0CE7BE/1012870.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_2',
    cooldown: 4,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 2.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DEFLECTING_SHOT]: {
    name: 'Deflecting Shot',
    icon: 'https://render.guildwars2.com/file/71415F58F7FF445672ADA1DA7BC12576E7FA557B/1012871.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_3',
    cooldown: 10,
    castTimeMs: 600,
    // Keep the shot's strike and control on one impact.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ])
  },
  [ID.SYMBOL_OF_ENERGY]: {
    name: 'Symbol of Energy',
    icon: 'https://render.guildwars2.com/file/7DFEE492C091D39ABA7F26020F06FFE0C7A30453/1012872.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_4',

    cooldown: 12,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 400,
    // The symbol creates its four-second Light field with the initial impact.
    comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startAnchor: 'castEnd' }],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 1.38,
        hits: 1,
        name: 'Symbol of Energy - Initial Damage'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 2.07 / 4,
        atMs: 1000,
        applications: 4,
        intervalMs: 1000,
        name: 'Symbol of Energy - Symbol Damage',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.HUNTERS_WARD]: {
    name: "Hunter's Ward",
    icon: 'https://render.guildwars2.com/file/BA2C3116B20CF142F70D18394E377A043D3E0E96/1012873.png',
    type: 'Weapon',
    weapon: 'Longbow',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 680, coefficient: 0.75 },
          { atMs: 1200, coefficient: 0.75 },
          { atMs: 1720, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward - Arrow Damage"
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2240, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward - Final Impact Damage"
      }
    ]
  }
};
