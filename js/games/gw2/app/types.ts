/** Composes application state, adapters, and runtime callbacks from domain-owned contracts. */
import type { BuildEditor, SimulationPresentation } from '#browser/shell/types.js';
import type { BuildLibraryState } from '#gw2/app/build/library/state.js';
import type { ProfessionDefaultOffhand, ProfessionIsSkillAvailable } from '#gw2/app/build/types.js';
import type { ModifierPresentation } from '#gw2/app/modifier-reference/presentation.js';
import type { RelicComparisonRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import type { ResultViewState } from '#gw2/app/results/state.js';
import type { RotationComparisonSession } from '#gw2/app/rotation/comparison-state.js';
import type { CursorPreviewRun } from '#gw2/app/rotation/cursor-preview.js';
import type { RotationActionOptions, RotationEditingState } from '#gw2/app/rotation/editing/state.js';
import type { RotationTimelineState } from '#gw2/app/rotation/timeline/state.js';
import type { ProfessionTooltips, SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import type { AnalysisRequestInput, AnalysisRequestSnapshot } from '#gw2/app/simulation/analysis-request-snapshot.js';
import type { AnalysisResult, AnalysisResultLifecycle } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import type {
  ModifierContribution,
  ModifierContributionRequest
} from '#gw2/app/simulation/modifier-contributions/types.js';
import type {
  RandomDistributionOptions,
  RandomDistributionRequest,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';
import type { BuildAttributes, BuildContextFactory, BuildContextProfession } from '#gw2/build-context/types.js';
import type { PatchOverviewEntry } from '#gw2/integrations/patches/authoring/overview-generation.js';
import type { ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { FixedSlotLoadout } from '#gw2/platform/builds/slot-loadout.js';
import type { Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2WeaponDataEntry, Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** UI adapters retain the same bound calculator and patch contract as headless build contexts. */
export type ProfessionAppContract = BuildContextProfession & {
  readonly nativeDefinition: {
    /** Reference views read trait and skill ownership from the same registered modules as simulation. */
    readonly modules: readonly import('#gw2/platform/profession-definition/module-types.js').AnyNativeModule[];
    readonly moduleVariants?: Readonly<
      Record<string, import('#gw2/platform/profession-definition/module-types.js').AnyNativeModule>
    >;
  };
  readonly patchOverviewFor: (config: Gw2Config, observedIds: readonly SkillId[]) => readonly PatchOverviewEntry[];
};

export interface ProfessionAppState
  extends BuildLibraryState, RotationEditingState, RotationTimelineState, RotationComparisonSession, ResultViewState {
  readonly skillDamage: import('#gw2/app/build/skill-damage/lifecycle.js').SkillDamageLifecycle;
  gearOptimizerRunner?: import('#gw2/app/optimizer/gear/runner.js').GearOptimizerRunner;
  workspace?: import('#gw2/app/build/state/workspace.js').BuildWorkspace;
  activateBuildTab?(id: string, workspace?: import('#gw2/app/build/state/workspace.js').BuildWorkspace): void;
  readonly gameId: string;
  readonly contentId: string;
  adapter: Gw2AppAdapter;
  profession: ProfessionAppContract;
  /** All skill lists and lookups follow this catalog when the active patch or workspace tab changes. */
  readonly activeCatalog: Readonly<CanonicalCatalog>;
  patch: ResolvedPatch;
  build: Gw2CanonicalBuild;
  simulationSettings?: import('#gw2/app/simulation/settings.js').SimulationSettings;
  weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  relicNames: readonly string[];
  resourceDefinitions(specialization: string): ProfessionResourceView[];
  attributeWeaponSet: number;
  attributeData: BuildAttributes | null;
  /** Debug capture belongs to this app session and is excluded from persisted build state. */
  damageDiagnostics: boolean;
  setDamageDiagnostics(enabled: boolean): void;
  readonly analysis: AnalysisResultLifecycle;
  modifierContributionRunner: import('#gw2/app/simulation/modifier-contributions/runner.js').ModifierContributionRunner;
  randomDistributionRunner: import('#gw2/app/simulation/random-distribution/runner.js').RandomDistributionRunner;
  relicComparisonRunner: import('#gw2/app/optimizer/relic-comparison/runner.js').RelicComparisonRunner;
  baselineSimulationRunner: import('#gw2/app/simulation/baseline/runner.js').BaselineSimulationRunner;
  changed(rebuildStatic?: boolean, rebuildGear?: boolean, options?: ProfessionChangeOptions): void;
  startRotationComparison(): void;
  loadRotationReference(rotation: readonly RotationCommand[]): void;
  clearRotationReference(): void;
  swapRotationComparison(): void;
  exitRotationComparison(): void;
  renderAttributes(): void;
  addRotation(name: string, options?: RotationActionOptions): void;
  selectRotationInsertion(index: number | null): void;
  runRandomDistribution(): void;
  runRelicComparison(comparisonRelic?: string, initialStacks?: number): void;
  selectPatch(patchId: string): void;
}

export interface ProfessionChangeOptions {
  /** A reference swap adopts its matching result while refreshing Current-only output. */
  readonly adoptedResult?: AnalysisResult;
  /** Holds replacement-heavy rotation UI until its matching simulation result is ready. */
  readonly deferRotationRender?: boolean;
  /** Only switching game-data versions can retain the unchanged build's previously visited patch results. */
  readonly patchSwitch?: boolean;
}

export interface ProfessionAppFilenames {
  readonly build: string;
  readonly rotation: string;
  readonly eventLog: string;
}

export interface ProfessionRuntimeOptions {
  readonly profession: ProfessionAppContract;
  readonly createBuildContext: BuildContextFactory;
}

export interface ProfessionRuntimeApi {
  eliteSpecialization(build: Gw2CanonicalBuild): string;
  readonly createBuildContext: BuildContextFactory;
  captureAnalysis(input: AnalysisRequestInput): AnalysisRequestSnapshot;
  calculateModifierContributions(request: ModifierContributionRequest): ModifierContribution[];
  relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonRequest | null;
  calculateRandomDistribution(
    request: RandomDistributionRequest,
    options?: RandomDistributionOptions
  ): RandomDistributionSummary;
  /** Executes detached cursor work; the cursor preview module owns selection, freshness, and reuse. */
  calculateCursorPreview(request: CursorPreviewRun): Gw2SimulationResult;
  calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput;
}

export interface Gw2AppAdapter extends ProfessionRuntimeApi {
  /** Null marks internal mechanics; undefined leaves an ordinary skill's existing tooltip authoritative. */
  readonly modifierPresentation: (
    rule: Gw2ModifierRule,
    patch: ResolvedPatch
  ) => ModifierPresentation | null | undefined;
  readonly skillTooltip: (
    skill: Skill,
    patch: ResolvedPatch,
    build?: Pick<Gw2CanonicalBuild, 'specializations'>
  ) => SimulationTooltip;
  readonly traitTooltip: (trait: CatalogEntity, patch: ResolvedPatch, specialization: string) => SimulationTooltip;
  readonly gameId: 'gw2';
  readonly contentId: string;
  readonly id: string;
  readonly name: string;
  readonly profession: ProfessionAppContract;
  readonly storageKey: string;
  readonly globalName: string;
  readonly filenames: ProfessionAppFilenames;
  readonly resetPrompt: string;
  readonly toApplicationBuild: (build: unknown) => Gw2CanonicalBuild;
  readonly isSkillAvailable: ProfessionIsSkillAvailable;
  readonly defaultOffhand: ProfessionDefaultOffhand;
  readonly weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  readonly relicNames: readonly string[];
  readonly renderRotationBuilder: (app: ProfessionAppState) => void;
  readonly buildEditor: BuildEditor<ProfessionAppState>;
  readonly presentation: SimulationPresentation<ProfessionAppState>;
  readonly slotLoadout: FixedSlotLoadout<Gw2CanonicalBuild> | null;
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
  readonly weaponSkillMatchesSet: Gw2WeaponSkillMatcher;
}

export interface DefineProfessionAppOptions {
  readonly tooltips: ProfessionTooltips;
  readonly profession: ProfessionAppContract;
  readonly createBuildContext: BuildContextFactory;
  readonly toApplicationBuild: (build: unknown) => Gw2CanonicalBuild;
  readonly storageVersion?: number;
  readonly resetPrompt?: string;
  readonly isSkillAvailable?: ProfessionIsSkillAvailable;
  readonly defaultOffhand?: ProfessionDefaultOffhand;
}
