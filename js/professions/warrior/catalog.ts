import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { warriorNativeModules } from './modules.js';

export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules);
export const WARRIOR_SKILLS = warriorCatalog.skills;
