import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { revenantNativeModules } from './modules.js';

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
export const REVENANT_SKILLS = revenantCatalog.skills;
