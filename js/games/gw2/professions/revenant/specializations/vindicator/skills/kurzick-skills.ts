/** Kurzick skills retain their costs, boons, and Urn lifecycle at the simulation's fixed full player health. */
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const VINDICATOR_KURZICK_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.SELFLESS_SPIRIT]: {
    name: 'Selfless Spirit',
    icon: 'https://render.guildwars2.com/file/3F9F107D2DE406A636B1960A3D94A97BDD292115/2491621.png',
    type: 'Heal',
    slot: 'Heal',
    loadoutSkillId: ID.SELFISH_SPIRIT,
    legendId: 'LegendaryAlliance',
    cooldown: 10,
    energyCost: 10,
    castTimeMs: 1320,
    // Healing allies does not change damage simulation state.
    effects: []
  },
  [ID.BATTLE_DANCE]: {
    name: 'Battle Dance',
    icon: 'https://render.guildwars2.com/file/56A31080722DD2630E72D8D64E0D1EDD25E528AD/2491608.png',
    type: 'Utility',
    slot: 'Utility',
    loadoutSkillId: ID.NOMADS_ADVANCE,
    legendId: 'LegendaryAlliance',
    cooldown: 3,
    energyCost: 15,
    castTimeMs: 960,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 3,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.TREE_SONG]: {
    name: 'Tree Song',
    icon: 'https://render.guildwars2.com/file/1E0A36E2061E093D6F1769C11A1709E02AD10C0A/2491623.png',
    type: 'Utility',
    slot: 'Utility',
    loadoutSkillId: ID.SCAVENGER_BURST,
    legendId: 'LegendaryAlliance',
    cooldown: 3,
    energyCost: 15,
    castTimeMs: 280,
    // Count the player as one affected ally; other allies and incoming conditions are not simulated.
    resourceGain: 2,
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ],
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.AWAKENING]: {
    name: 'Awakening',
    icon: 'https://render.guildwars2.com/file/6719DBBC4AD2B29CAB33C30B62DC990E07A79A9E/2491607.png',
    type: 'Utility',
    slot: 'Utility',
    loadoutSkillId: ID.REAVERS_RAGE,
    legendId: 'LegendaryAlliance',
    cooldown: 10,
    energyCost: 15,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'boon', boon: BOON.STABILITY, duration: 1, stacks: 1 }
    ]
  },
  [ID.URN_OF_SAINT_VIKTOR]: {
    name: 'Urn of Saint Viktor',
    icon: 'https://render.guildwars2.com/file/317EB806A8487B77040BC0C673A59096F396EEE4/2491625.png',
    type: 'Elite',
    slot: 'Elite',
    loadoutSkillId: ID.SPEAR_OF_ARCHEMORUS,
    legendId: 'LegendaryAlliance',
    cooldown: 0,
    manualReleaseCooldown: 2,
    starvationCooldown: 2,
    energyCost: 0,
    upkeepCost: 5,
    castTimeMs: 0,
    // Shared upkeep owns Energy drain and release access. Health loss and healing remain outside scope.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ],
    effects: []
  },
  [ID.DROP_URN_OF_SAINT_VIKTOR]: {
    name: 'Drop Urn of Saint Viktor',
    icon: 'https://render.guildwars2.com/file/0CD2A5C3AA46D97FF19CDEB50D3841E429EACF9C/2491609.png',
    type: 'Elite',
    slot: 'Elite',
    legendId: 'LegendaryAlliance',
    cooldown: 1,
    energyCost: 0,
    castTimeMs: 720,
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }],
    // At full player health, dropping the Urn grants no health-threshold boons.
    effects: []
  }
};
