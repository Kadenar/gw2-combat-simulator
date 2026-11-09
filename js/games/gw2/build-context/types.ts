import type { NativePatchAuthoringContract } from '#gw2/integrations/patches/authoring/module-types.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import type { PatchSelection, ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import type {
  Gw2AttributeContributionCalculator,
  Gw2FinalizedAttributeResult
} from '#gw2/platform/attributes/types.js';
import type { ResolvedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { BoonId } from '#gw2/platform/constants.js';
import type { TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { AnyNativeModule } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CatalogEntity, SkillId } from '#gw2/platform/skills/types.js';

export type WeaponSetNumber = 1 | 2;

export type ProfessionModifierType = 'Boon' | 'Target' | 'Sigil' | 'Relic' | 'Food' | 'Utility' | 'Trait' | 'Skill';

export type ProfessionModifier = {
  readonly id: string;
  readonly label: string;
} & (
  | { readonly type: 'Boon'; readonly boonId: BoonId }
  | { readonly type: 'Skill'; readonly name: string; readonly skillId: SkillId }
  | { readonly type: Exclude<ProfessionModifierType, 'Skill' | 'Boon'>; readonly name: string }
);

export interface BuildAttributes extends Readonly<Gw2FinalizedAttributeResult> {
  readonly activeTraits: readonly CatalogEntity[];
}

/** Explicit build dependencies keep headless configuration independent of lazy profession presentation. */
export interface BuildContextDeclarations<TBuild extends Gw2CanonicalBuild> {
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
  readonly resolveSkillLoadout: (build: Readonly<TBuild>, specialization: string) => ResolvedSkillLoadout;
}

/** A context borrows an immutable build for one calculation; callers create a new context after edits. */
export interface BuildContextInput<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> {
  readonly build: Readonly<TBuild>;
  readonly patch: ResolvedPatch;
  readonly transitionDelays: Readonly<TransitionDelays>;
  readonly disabledModifier?: Readonly<ProfessionModifier>;
}

export interface BuildContext {
  readonly specialization: string;
  readonly selectedSkillIds: readonly SkillId[];
  attributes(weaponSet: WeaponSetNumber): BuildAttributes;
  simulationConfig(): Gw2Config;
}

/** Bound modules retain their concrete build input; heterogeneous loaders accept codec-validated builds. */
export type BuildContextFactory<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> = {
  create(input: BuildContextInput<TBuild>): BuildContext;
}['create'];

export type BuildContextProfession = Gw2ProfessionSource & {
  /** Attribute previews use the calculator owned by this patch-bound profession. */
  readonly attributeContributions: Gw2AttributeContributionCalculator;
  readonly preview?: PatchPreview | null;
  /** Bound professions resolve the selected patch and reject unavailable patch IDs. */
  readonly resolvePatch: (selection?: PatchSelection) => ResolvedPatch;
};

export interface BuildContextModule {
  readonly profession: BuildContextProfession;
  readonly createBuildContext: BuildContextFactory;
  readonly toApplicationBuild: (value: unknown) => Gw2CanonicalBuild;
}

/** Erase native module tuples only at the shared execution boundary; factories keep their concrete build types. */
export type BoundProfession = NativePatchAuthoringContract<readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]]>;
