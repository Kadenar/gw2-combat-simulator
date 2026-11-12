import { ACTOR, COMBO_FINISHER, CONTROL } from '#gw2/platform/constants.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { songOfArboreumSelected } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Energy Meld grants its ordinary endurance unless the trait replaces that reward. */
const energyMeldRewards: readonly SkillSideEffect[] = [
  {
    on: 'castCommit',
    when: (runtime) => !songOfArboreumSelected(runtime),
    do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
  },
  { on: 'castCommit', do: { type: 'revenant.energy-meld-endurance' } }
];

export const VINDICATOR_PROFESSION_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<RevenantSkill>>> = {
  [ID.ALLIANCE_TACTICS]: {
    name: 'Alliance Tactics',
    icon: 'https://render.guildwars2.com/file/DE01C14360F2E7E81C336241C7D6ED6FA14DA005/2491605.png',
    type: 'Profession',
    slot: 'Profession_3',
    resourceGain: 10,
    legendId: 'LegendaryAlliance',
    cooldown: 3,
    energyCost: 0,
    castTimeMs: 0,
    effects: [],
    // Switching faction changes access without invoking another legend or resetting Energy.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.alliance-tactics' } }]
  },
  // Friend of the Luxons grants this attack independently of the equipped legends.
  [ID.ARCHEMORUS_STRIKE]: {
    name: "Archemorus's Strike",
    icon: 'https://render.guildwars2.com/file/223954AEBBECE555910FB16CE15073239CEDCC60/3833327.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 25,
    energyCost: 0,
    castTimeMs: 680,
    comboFinishers: [{ ownerId: 'revenant', finisherType: COMBO_FINISHER.BLAST }],
    effects: [
      {
        type: 'strike',
        name: "Archemorus's Strike",
        coefficient: 3,
        atMs: 600,
        timingAnchor: 'castStart',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        hits: 1,
        actorType: ACTOR.PLAYER
      },
      { type: 'control', controlKind: CONTROL.KNOCKDOWN, actorType: ACTOR.PLAYER, atMs: 600, timingAnchor: 'castStart' }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    name: 'Legendary Alliance Stance',
    icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.ENERGY_MELD]: {
    name: 'Energy Meld',
    icon: 'https://render.guildwars2.com/file/CABAB825B746117F51E4F35844622D3A3862D3E4/2491610.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    castTimeMs: 440,
    effects: [],
    sideEffects: energyMeldRewards
  },
  [ID.ENERGY_MELD_ID_72058]: {
    name: 'Energy Meld',
    icon: 'https://render.guildwars2.com/file/CABAB825B746117F51E4F35844622D3A3862D3E4/2491610.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    castTimeMs: 440,
    effects: [],
    sideEffects: energyMeldRewards
  },
  [ID.CALL_OF_THE_ALLIANCE]: {
    name: 'Call of the Alliance',
    icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png',
    type: 'Action',
    slot: 'Action',
    cooldown: 0,
    energyCost: 0,
    resourceGain: 8,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Alliance',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE]: {
    name: 'Legendary Alliance Stance',
    icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  }
};
