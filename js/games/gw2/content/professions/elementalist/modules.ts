import { elementalistCoreModule } from './core/module.js';
import { catalystModule } from './specializations/catalyst/module.js';
import { evokerModule } from './specializations/evoker/module.js';
import { tempestModule } from './specializations/tempest/module.js';
import { weaverModule } from './specializations/weaver/module.js';

export const elementalistNativeModules = Object.freeze([
  elementalistCoreModule,
  tempestModule,
  weaverModule,
  catalystModule,
  evokerModule
] as const);

export const ELEMENTALIST_NATIVE_CATALOG_OPTIONS = Object.freeze({
  skillNameCollision: 'first' as const
});
