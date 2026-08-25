import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { warriorNativeModules } from './modules.js';

export const WARRIOR_ELITE_SPECIALIZATIONS = Object.freeze(['Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon']);
export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules);
export const WARRIOR_SKILLS = warriorCatalog.skills;
