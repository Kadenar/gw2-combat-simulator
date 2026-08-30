/** Public authoring surface for declaring native profession modules and their mechanics. */
export { defineNativeModule, defineNativeProfession } from '#gw2/integrations/patches/authoring/profession.js';
export { defineSkillVariantProfile, defineTraitProfile } from '#gw2/integrations/patches/authoring/balance-profiles.js';
export type { BalanceProfileFields } from '#gw2/integrations/patches/authoring/balance-profiles.js';
export {
  assembleNativeApplicationCatalog,
  createNativeModuleData,
  nativeSkillRuntimeOwner
} from '#gw2/integrations/patches/authoring/catalog.js';
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
} from '#gw2/integrations/patches/authoring/mechanics.js';
export type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
export type {
  AnyNativeModule,
  NativeAutoattackChains,
  NativeCatalogOptions,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState
} from '#gw2/integrations/patches/authoring/module-types.js';
export type {
  AutoattackChainContext,
  AutoattackChainOverride,
  AutoattackChainTransition,
  AutoattackChainTransitionContext,
  AutoattackChainTransitionResult,
  Gw2AutoattackChainOptions
} from '#gw2/platform/skills/autoattack-chains.js';
