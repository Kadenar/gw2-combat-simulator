import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from './catalog-data.js';
import { mesmerNativeModules } from './modules.js';

export const mesmerCatalog = assembleNativeApplicationCatalog(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);
