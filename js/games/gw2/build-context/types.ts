import type { Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { Gw2FinalizedAttributeResult } from '#gw2/platform/attributes/types.js';
import type { ResolvedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { CatalogEntity, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type { AnyNativeModule } from '#gw2/platform/profession-definition/module-types.js';
import type { NativePatchAuthoringContract } from '#gw2/integrations/patches/authoring/module-types.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';

export type WeaponSet = 1 | 2;

export type ProfessionModifierType = 'Boon' | 'Target' | 'Sigil' | 'Relic' | 'Food' | 'Utility' | 'Trait' | 'Skill';

export type ProfessionModifier = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
} & (
  { readonly type: 'Skill'; readonly skillId: SkillId } | { readonly type: Exclude<ProfessionModifierType, 'Skill'> }
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
  readonly patchId: string;
  readonly transitionDelays: Readonly<TransitionDelays>;
  readonly disabledModifier?: Readonly<ProfessionModifier>;
}

export interface BuildContext {
  readonly profession: Gw2ProfessionSource;
  readonly specialization: string;
  readonly selectedSkillIds: readonly SkillId[];
  attributes(weaponSet: WeaponSet): BuildAttributes;
  simulationConfig(): Gw2Config;
}

/** Bound modules retain their concrete build input; heterogeneous loaders accept codec-validated builds. */
export type BuildContextFactory<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> = {
  create(input: BuildContextInput<TBuild>): BuildContext;
}['create'];

export type BuildContextProfession = Gw2ProfessionSource & {
  readonly preview?: PatchPreview | null;
  /** Bound professions resolve the selected patch and reject unavailable patch IDs. */
  readonly catalogFor: (patchId?: string) => Readonly<CanonicalCatalog>;
  readonly balanceContextFor: (patchId?: string) => ProfessionBalanceContext;
};

export interface BuildContextModule {
  readonly profession: BuildContextProfession;
  readonly createBuildContext: BuildContextFactory;
  readonly toApplicationBuild: (value: unknown) => Gw2CanonicalBuild;
}

/** Erase native module tuples only at the shared execution boundary; factories keep their concrete build types. */
export type BoundProfession = NativePatchAuthoringContract<readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]]>;
