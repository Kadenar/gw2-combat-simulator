import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { ELEMENTALIST_NATIVE_CATALOG_OPTIONS, elementalistNativeModules } from './modules.js';

export const elementalistCatalog = assembleNativeApplicationCatalog(
  elementalistNativeModules,
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS
);
