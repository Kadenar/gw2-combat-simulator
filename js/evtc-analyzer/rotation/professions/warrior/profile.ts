import type { ProfessionProfileSource } from '../../profiles.js';
import { BLADESWORN_BUFF_TRANSITIONS } from './bladesworn.js';
import { PARAGON_SKILL_ID_ALIASES } from './paragon.js';

/**
 * Describes the Warrior family to the generic EVTC reader. Paragon aliases
 * collapse alternate ArcDPS IDs before catalog lookup, while Bladesworn mode
 * transitions turn Gunsaber buff changes into explicit bundle actions.
 */
export const warriorProfileSource: ProfessionProfileSource = {
  id: 'warrior',
  name: 'Warrior',
  specializations: {
    core: 'Core',
    berserker: 'Berserker',
    spellbreaker: 'Spellbreaker',
    bladesworn: 'Bladesworn',
    paragon: 'Paragon'
  },
  skillIdAliasesBySpecialization: {
    paragon: PARAGON_SKILL_ID_ALIASES
  },
  buffTransitionsBySpecialization: {
    bladesworn: BLADESWORN_BUFF_TRANSITIONS
  }
};
