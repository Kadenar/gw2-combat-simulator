import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { rangerNativeModules } from './modules.js';

export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
