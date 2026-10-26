import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { evokerModule } from '#gw2/professions/elementalist/specializations/evoker/module.js';
import { tempestModule } from '#gw2/professions/elementalist/specializations/tempest/module.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';

// Kept apart from profession.ts because build/ reads the catalog while profession.ts imports build/.

/**
 * The Elementalist family's module set: the core module plus one module per elite
 * specialization. Core must stay first — it is the owner of base-game skills, traits,
 * and weapon data, and later modules layer their own contributions over it.
 */
export const elementalistNativeModules = Object.freeze([
  elementalistCoreModule,
  tempestModule,
  weaverModule,
  catalystModule,
  evokerModule
] as const);

/**
 * The application-side Elementalist catalog: every module's skills, traits, and weapon
 * data merged into one lookup for the build editor and rotation UI, assembled once at
 * import time and independent of the runtime catalog the simulation uses.
 */
export const elementalistCatalog = assembleNativeApplicationCatalog(elementalistNativeModules);
