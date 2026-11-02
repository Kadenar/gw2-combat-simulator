/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Snap each intended packet independently so rounding a repeated interval cannot accumulate drift.
export const REVENANT_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.RAPID_SWIPE]: {
    name: 'Rapid Swipe',
    icon: 'https://render.guildwars2.com/file/2ECDC80E365C9147A05C50490BF3DFE6FAE009FE/1012993.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        name: 'Rapid Swipe',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FORCEFUL_BASH]: {
    name: 'Forceful Bash',
    icon: 'https://render.guildwars2.com/file/29D643D46935DC1BDBA8C752ED4860135F1E6502/1012994.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Forceful Bash',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.REJUVENATING_ASSAULT]: {
    name: 'Rejuvenating Assault',
    icon: 'https://render.guildwars2.com/file/5CEC75C6494329457DC36C972204952ECF80E5C3/1012995.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 680,
    comboFinishers: [{ ownerId: 'revenant', finisherType: COMBO_FINISHER.WHIRL }],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(340 + index * 340),
          coefficient: 2 / 2
        })),
        name: 'Rejuvenating Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.MENDERS_REBUKE]: {
    name: "Mender's Rebuke",
    icon: 'https://render.guildwars2.com/file/0F7CB313454F1B2A3568E54F439D7ED36F2A7075/1012996.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    cooldown: 5,
    energyCost: 5,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: "Mender's Rebuke",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.WARDING_RIFT]: {
    name: 'Warding Rift',
    icon: 'https://render.guildwars2.com/file/DD1CCDF4034E9CF70346FFBDA643F908B096077F/1012997.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    cooldown: 12,
    energyCost: 10,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Warding Rift',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.RENEWING_WAVE]: {
    name: 'Renewing Wave',
    icon: 'https://render.guildwars2.com/file/08B93F4A0EA8B764F9F6F80721F7AD3DC02565A0/1012998.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    cooldown: 15,
    energyCost: 15,
    castTimeMs: 680,
    effects: []
  },
  [ID.SURGE_OF_THE_MISTS]: {
    name: 'Surge of the Mists',
    icon: 'https://render.guildwars2.com/file/F4355F2FB422A7C316EDCBF6E897EC9A72C4D26D/1012999.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    cooldown: 20,
    energyCost: 15,
    // Reviewed timings are Quickness durations; Surge's coefficient is the total across nine hits.
    castTimeMs: 1720,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: quantizeGw2ActionTimingMs(75.48 + index * 75.48), // TODO: Validate these estimated packet offsets against a combat log.
          coefficient: 3.24 / 9
        })),
        name: 'Surge of the Mists',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  }
};
