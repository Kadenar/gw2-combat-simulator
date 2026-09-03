/** Owns Core Revenant trait-triggered skill fragments and supplemental identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_TRAIT_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RITE_OF_THE_GREAT_DWARF_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 45,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.VENGEFUL_SNOWBALLS]: {
    castTimeMs: 0,
    cooldown: 45,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.ESSENCE_SAP_DOPPELGANGER]: {
    castTimeMs: 250,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Essence Sap (Doppelganger)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.REPLENISHING_DESPAIR_TRAIT_SKILL]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.064,
        hits: 1,
        name: 'Replenishing Despair (trait skill)',
        actorType: 'player'
      }
    ]
  }
});
