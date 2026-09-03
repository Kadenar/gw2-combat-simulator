import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import {
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS,
  elementalistNativeModules
} from '#gw2/professions/elementalist/modules.js';

/**
 * The application-side Elementalist catalog: every module's skills, traits, and weapon
 * data merged into one lookup for the build editor and rotation UI, assembled once at
 * import time and independent of the runtime catalog the simulation uses.
 */
export const elementalistCatalog = assembleNativeApplicationCatalog(
  elementalistNativeModules,
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS
);
