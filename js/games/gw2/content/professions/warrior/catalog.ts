import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { warriorNativeModules } from './modules.js';

export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules);
