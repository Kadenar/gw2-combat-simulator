import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { evokerModule } from '#gw2/professions/elementalist/specializations/evoker/module.js';
import { tempestModule } from '#gw2/professions/elementalist/specializations/tempest/module.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';

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
 * Catalog assembly policy shared by the runtime and application catalogs: when two
 * modules declare skills with the same name, the first module in order keeps the
 * name lookup so elite variants cannot shadow the core identity.
 */
export const ELEMENTALIST_NATIVE_CATALOG_OPTIONS = Object.freeze({
  skillNameCollision: 'first' as const
});
