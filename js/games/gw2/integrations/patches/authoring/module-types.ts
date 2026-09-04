import type {
  BalanceProfile,
  CanonicalCatalog,
  CatalogEntity,
  Skill,
  SkillId
} from '#gw2/platform/engine/skills/types.js';
import type {
  AnyNativeModule,
  NativeProfessionContract as StableNativeProfessionContract
} from '#gw2/platform/profession-definition/module-types.js';
import type {
  PatchPreview,
  PatchRuntimeValues,
  ProfessionPatchPreview
} from '#gw2/integrations/patches/authoring/patches.js';

export interface NativePreviewModifierRuleTarget {
  readonly id: string;
  readonly moduleId: string;
  readonly fields: readonly string[];
}

export interface NativePatchAuthoringSkill {
  readonly id: SkillId;
  readonly name: string;
  readonly moduleId: string;
  /** Sanitized authoring reference; the runtime catalog retains complete cast timing. */
  readonly skill: Readonly<Skill>;
  readonly patchableFields: Readonly<Record<string, number>>;
}

export interface NativePatchAuthoringBalanceProfile {
  readonly id: SkillId;
  readonly name: string;
  readonly moduleId: string;
  /** Sanitized authoring reference; the runtime catalog retains the complete profile. */
  readonly profile: Readonly<BalanceProfile>;
  readonly patchableFields: Readonly<Record<string, number>>;
}

export interface NativePatchAuthoringModifierValue {
  readonly kind: 'static' | 'resolver' | 'absent';
  readonly value?: number;
}

export interface NativePatchAuthoringModifierRule {
  readonly id: string;
  readonly label: string | null;
  readonly moduleId: string;
  readonly targets: readonly string[];
  readonly operation: string;
  readonly amount: NativePatchAuthoringModifierValue;
  readonly factor: NativePatchAuthoringModifierValue;
  readonly parameters: Readonly<Record<string, number>>;
  readonly conditional: boolean;
  readonly order: number;
}

export interface NativePatchAuthoringModule {
  readonly id: string;
  readonly traits: readonly Readonly<CatalogEntity>[];
  readonly skills: readonly NativePatchAuthoringSkill[];
  /** Trait and mechanic profiles only; skill-owned variants have their own authoring collection. */
  readonly balanceProfiles: readonly NativePatchAuthoringBalanceProfile[];
  readonly skillVariants: readonly NativePatchAuthoringBalanceProfile[];
  readonly modifierRules: readonly NativePatchAuthoringModifierRule[];
}

export interface NativePatchAuthoringMetadata {
  readonly professionId: string;
  readonly professionName: string;
  readonly modules: readonly NativePatchAuthoringModule[];
}

export type NativeProfessionContract<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
> = StableNativeProfessionContract<TModules, TPresentation, TSimulation> & {
  readonly preview: PatchPreview | null;
  readonly catalogFor: (patchId?: string) => Readonly<CanonicalCatalog>;
  readonly patchValuesFor: (patchId?: string) => PatchRuntimeValues;
  /** Serializable live metadata consumed by the local patch authoring UI. */
  readonly patchAuthoring: NativePatchAuthoringMetadata;
  /** Validates one profession's authored edits against live declarations. */
  readonly validatePatch: (patch: ProfessionPatchPreview | null | undefined) => true;
  /** Validated report metadata for modifier rules touched by the preview. */
  readonly previewModifierRuleTargets: readonly NativePreviewModifierRuleTarget[];
};
