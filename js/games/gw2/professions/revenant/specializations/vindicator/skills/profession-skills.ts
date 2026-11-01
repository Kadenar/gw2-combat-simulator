import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { songOfArboreumSelected } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';

/** Energy Meld grants its ordinary endurance unless the trait replaces that reward. */
const energyMeldRewards: readonly SkillSideEffect[] = [
  {
    on: 'castCommit',
    when: (runtime) => !songOfArboreumSelected(runtime),
    do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
  },
  { on: 'castCommit', do: { type: 'revenant.energy-meld-endurance' } }
];

export const VINDICATOR_PROFESSION_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    name: 'Legendary Alliance Stance',
    description: 'Invoke the power of the legendary champions Archemorus and Saint Viktor.',
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
    description: 'Gain endurance.',
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
    description: 'Gain endurance.',
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
    description: 'Gain endurance and strike enemies around you, gaining bonus endurance for each enemy struck.',
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
    description: 'Invoke the power of the legendary champions Archemorus and Saint Viktor.',
    icon: 'https://render.guildwars2.com/file/E1910F4C5C74E0B00AB262D2D3DBA3FB51BE90CA/2491626.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  }
});
