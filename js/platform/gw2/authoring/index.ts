/** Public authoring surface for declaring native profession modules and their mechanics. */
export { defineNativeModule, defineNativeProfession } from './profession.js';
export { assembleNativeApplicationCatalog, createNativeModuleData, nativeSkillRuntimeOwner } from './catalog.js';
export {
  augmentSkill,
  replaceSkill,
  afterSkillEffects,
  skillAvailability,
  onAuraApplied,
  onBuffApplied,
  onComboResolved,
  onConditionApplied,
  onFoodProcCreated,
  onResolvedBlind,
  onResolvedControl,
  onResolvedCriticalHit,
  onResolvedDamage
} from './mechanics.js';
export type { ResolvedCriticalHitOptions } from './mechanics.js';
export type {
  AnyNativeModule,
  NativeAutoattackChains,
  NativeCatalogOptions,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState
} from './module-types.js';
