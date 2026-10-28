import type { PatchOverviewEntry } from '#gw2/integrations/patches/authoring/overview-generation.js';
import type { PatchPreview, ProfessionPatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import type { PatchSelection, ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { AnyNativeModule, NativeProfessionContract } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { NumericFieldSpec } from '#gw2/platform/skills/field-specs.js';
import type { BalanceProfile, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';

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
  /** Selected profile descriptors with labels specialized by static attribute declarations. */
  readonly fieldSpecs: Readonly<Record<string, NumericFieldSpec>>;
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
  /** Trait tuning; skills own their intrinsic and conditional payloads directly. */
  readonly balanceProfiles: readonly NativePatchAuthoringBalanceProfile[];
  readonly modifierRules: readonly NativePatchAuthoringModifierRule[];
}

export interface NativePatchAuthoringMetadata {
  readonly professionId: string;
  readonly professionName: string;
  /** Labels and units of patchable skill fields, shared and profession-owned, as plain serializable data. */
  readonly skillFields: Readonly<Record<string, Pick<NumericFieldSpec, 'label' | 'unit'>>>;
  readonly modules: readonly NativePatchAuthoringModule[];
}

export type NativePatchAuthoringContract<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TBuild extends Gw2Build = Gw2Build
> = NativeProfessionContract<TModules, TPresentation, TBuild> & {
  readonly preview: PatchPreview | null;
  /** Build-scoped notes share native ownership and equipment eligibility with simulation. */
  readonly patchOverviewFor: (config: Gw2Config, observedIds: readonly SkillId[]) => readonly PatchOverviewEntry[];
  readonly resolvePatch: (selection?: PatchSelection) => ResolvedPatch;
  /** Serializable live metadata consumed by the local patch authoring UI. */
  readonly patchAuthoring: NativePatchAuthoringMetadata;
  /** Validates one profession's authored edits against live declarations. */
  readonly validatePatch: (patch: ProfessionPatchPreview | null | undefined) => true;
  /** Validated report metadata for modifier rules touched by the preview. */
  readonly previewModifierRuleTargets: readonly NativePreviewModifierRuleTarget[];
};
