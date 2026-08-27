import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { revenantNativeModules } from './modules.js';

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
