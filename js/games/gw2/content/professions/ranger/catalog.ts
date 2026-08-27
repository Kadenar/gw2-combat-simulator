import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { rangerNativeModules } from './modules.js';

export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
