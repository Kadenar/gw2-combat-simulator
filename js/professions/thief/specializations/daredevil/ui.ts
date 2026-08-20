import { THIEF_STOLEN_SKILL_IDS } from '../../core/steal.js';
import { thiefStealPaletteGroups } from '../../core/ui.js';

// Daredevil owns its profession palette contribution while reusing the base Thief steal and stolen-skill pool.
export const daredevilUi = Object.freeze({
  paletteGroups: () => thiefStealPaletteGroups(),
  skillBarGroups: () => [
    {
      id: 'thief-stolen-skills',
      label: 'Stolen Skills',
      skillIds: [...THIEF_STOLEN_SKILL_IDS],
      color: '#9a535c'
    }
  ]
});
