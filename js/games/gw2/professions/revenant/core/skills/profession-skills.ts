/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RevenantRuntimeState } from '#gw2/professions/revenant/types.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';

export const REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LEGENDARY_DWARF_STANCE_ID_26650]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE_ID_27659]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_ASSASSIN_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE_ID_28141]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_CENTAUR_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE_ID_28376]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DWARF_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.LEGENDARY_DEMON_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ANCIENT_ECHO]: {
    // Select the channeled legend at acceptance and refund Energy only when the cast commits.
    castTimeMs: 360,
    cooldown: 20,
    energyCost: 0,
    resourceGain: 25,
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'energy', amount: { skillField: 'resourceGain' } } }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR },
        when: (runtime) =>
          readProfessionCoreState<RevenantRuntimeState['core']>(runtime.profession).activeLegendId === LEGEND.CENTAUR
      },
      {
        type: 'boon',
        boon: 'resistance',
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
    ]
  }
});
