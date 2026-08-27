import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { ELEMENTALIST_NATIVE_CATALOG_OPTIONS, elementalistNativeModules } from './modules.js';

export const elementalistCatalog = assembleNativeApplicationCatalog(
  elementalistNativeModules,
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS
);
