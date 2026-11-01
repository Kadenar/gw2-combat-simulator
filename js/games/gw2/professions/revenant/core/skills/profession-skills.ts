/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { BOON } from '#gw2/platform/constants.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantRuntimeState } from '#gw2/professions/revenant/types.js';

export const REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LEGENDARY_ASSASSIN_STANCE]: {
    name: 'Legendary Assassin Stance',
    description: 'Invoke the power of the legendary assassin Shiro Tagachi.',
    icon: 'https://render.guildwars2.com/file/67CDD35F6BC3072E0837715A5E0A90646529BAA2/1030005.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE]: {
    name: 'Legendary Centaur Stance',
    description: 'Invoke the power of the legendary centaur Ventari.',
    icon: 'https://render.guildwars2.com/file/6CFF31B50AA00CAF3D35A02562964802B55AD292/1024105.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.LEGENDARY_DWARF_STANCE]: {
    name: 'Legendary Dwarf Stance',
    description: 'Invoke the power of the legendary dwarf King Jalis Ironhammer.',
    icon: 'https://render.guildwars2.com/file/03C66FA8A89697A0C4D309484172080E3A1141EF/961410.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE]: {
    name: 'Legendary Demon Stance',
    description: 'Invoke the power of the legendary demon Mallyx the Unyielding.',
    icon: 'https://render.guildwars2.com/file/1A1407F7D34E5ED41B59A25F39EBF728CC926423/961413.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.ANCIENT_ECHO]: {
    name: 'Ancient Echo',
    description: 'Refresh your bond with your channeled legend, gaining energy and legend-specific effects.',
    icon: 'https://render.guildwars2.com/file/1D64DDAE58CA483FF80EBD6ED01861E95A4B0F77/2128020.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    energyCost: 0,
    resourceGain: 25,
    // Select the channeled legend at acceptance and refund Energy only when the cast commits.
    castTimeMs: 360,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR },
        when: (runtime) =>
          readProfessionCoreState<RevenantRuntimeState['core']>(runtime.profession).activeLegendId === LEGEND.CENTAUR
      },
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 3,
        stacks: 1,
        metadata: { legendId: LEGEND.DEMON },
        when: (runtime) =>
          readProfessionCoreState<RevenantRuntimeState['core']>(runtime.profession).activeLegendId === LEGEND.DEMON
      },
      {
        type: 'buff',
        kind: 'unblockable',
        duration: 5,
        stacks: 2,
        metadata: { legendId: LEGEND.ASSASSIN },
        when: (runtime) =>
          readProfessionCoreState<RevenantRuntimeState['core']>(runtime.profession).activeLegendId === LEGEND.ASSASSIN
      },
      {
        type: 'buff',
        kind: 'rite-of-the-great-dwarf',
        duration: 3,
        stacks: 1,
        metadata: { legendId: LEGEND.DWARF },
        when: (runtime) =>
          readProfessionCoreState<RevenantRuntimeState['core']>(runtime.profession).activeLegendId === LEGEND.DWARF
      }
    ],
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'energy', amount: { skillField: 'resourceGain' } } }
    ]
  }
});
