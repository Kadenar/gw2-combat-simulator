import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { NECROMANCER_NON_DPS_SKILL_NAMES } from './catalog-data.js';
import { necromancerNativeModules } from './modules.js';

export { NECROMANCER_NON_DPS_SKILL_NAMES };
export const NECROMANCER_ELITE_SPECIALIZATIONS = Object.freeze(['Reaper', 'Scourge', 'Harbinger', 'Ritualist']);
export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
export const NECROMANCER_SKILLS = necromancerCatalog.skills;
