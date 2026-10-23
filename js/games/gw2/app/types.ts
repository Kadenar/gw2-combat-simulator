import type { PatchSelection, ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import type { BuildContextFactory } from '#gw2/build-context/types.js';
import type { PatchOverviewEntry } from '#gw2/integrations/patches/authoring/overview-generation.js';
import type { BuildLibraryState } from '#gw2/app/build/library/state.js';
import type { RotationEditingState, RotationActionOptions } from '#gw2/app/rotation/editing/state.js';
import type { RotationTimelineState } from '#gw2/app/rotation/timeline/state.js';
import type { RotationComparisonSession } from '#gw2/app/rotation/comparison-state.js';
import type { ResultViewState } from '#gw2/app/results/state.js';
import type { FixedSlotLoadout } from '#gw2/platform/builds/slot-loadout.js';

import type { ProfessionTooltips, SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

/** Composes application state, adapters, and runtime callbacks from domain-owned contracts. */
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2SimulationResult, Gw2SimulationScore } from '#gw2/platform/results/types.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/options.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import type { CanonicalCatalog, CatalogLookup, SkillId, Skill, CatalogEntity } from '#gw2/platform/skills/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type {
  PatchComparison,
  BaselineSimulationOutput,
  BaselineSimulationResult,
  BaselineSimulationRequest
} from '#gw2/app/simulation/baseline/types.js';
import type {
  ModifierContribution,
  ModifierContributionResultState,
  ModifierContributionRequest
} from '#gw2/app/simulation/modifier-contributions/types.js';

import type {
  RandomDistributionSummary,
  RandomDistributionResultState,
  RandomDistributionJobRequest,
  RandomDistributionRequest,
  RandomDistributionOptions
} from '#gw2/app/simulation/random-distribution/types.js';
import type { RelicComparisonRequest, RelicComparisonResultState } from '#gw2/app/optimizer/relic-comparison/types.js';
import type { Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { Gw2WeaponDataEntry, Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import type { ProfessionIsSkillAvailable, ProfessionDefaultOffhand } from '#gw2/app/build/types.js';
import type { BuildAttributes } from '#gw2/build-context/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { BuildEditor, SimulationPresentation } from '#browser/shell/types.js';

export type ProfessionAppContract = Gw2ProfessionSource & {
  readonly nativeDefinition: {
    readonly moduleVariants?: Readonly<
      Record<string, import('#gw2/platform/profession-definition/module-types.js').AnyNativeModule>
    >;
  };
  readonly preview?: PatchPreview | null;
  readonly patchOverviewFor: (config: Gw2Config, observedIds: readonly SkillId[]) => readonly PatchOverviewEntry[];
  /** Bound professions resolve the selected patch and reject unavailable patch IDs. */
  readonly resolvePatch: (selection?: PatchSelection) => ResolvedPatch;
};

export interface ProfessionAppState
  extends BuildLibraryState, RotationEditingState, RotationTimelineState, RotationComparisonSession, ResultViewState {
  skillDamageRunner: import('#gw2/app/simulation/skill-damage/runner.js').SkillDamageRunner;
  gearOptimizerRunner?: import('#gw2/app/optimizer/gear/runner.js').GearOptimizerRunner;
  workspace?: import('#gw2/app/build/state/workspace.js').BuildWorkspace;
  activateBuildTab?(id: string): void;
  readonly gameId: string;
  readonly contentId: string;
  adapter: Gw2AppAdapter;
  profession: ProfessionAppContract;
  /** All skill lists and lookups follow this catalog when the active patch or workspace tab changes. */
  readonly activeCatalog: Readonly<CanonicalCatalog>;
  patch: ResolvedPatch;
  patchComparison: PatchComparison | null;
  build: Gw2CanonicalBuild;
  simulationSettings?: import('#gw2/app/simulation/settings.js').SimulationSettings;
  weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  relicNames: readonly string[];
  resourceDefinitions(specialization: string): ProfessionResourceView[];
  attributeWeaponSet: number;
  attributeData: BuildAttributes | null;
  results: ProfessionAppResult | null;
  /** Debug capture belongs to this app session and is excluded from persisted build state. */
  damageDiagnostics: boolean;
  setDamageDiagnostics(enabled: boolean): void;
  buildRevision: number;
  resultRevision: number;
  simulationStatus: 'idle' | 'queued' | 'running' | 'error';
  simulationError: string;
  modifierContributionRunner: ProfessionFeatureRunner;
  randomDistributionRunner: ProfessionFeatureRunner;
  relicComparisonRunner: ProfessionFeatureRunner;
  baselineSimulationRunner: {
    schedule(revision: number): void;
  };
  publishBaselineSimulation(output: BaselineSimulationOutput, revision: number, chartsOnly?: boolean): void;
  failBaselineSimulation(error: unknown, revision: number, chartsOnly?: boolean): void;
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
  /** Holds replacement-heavy rotation UI until its matching simulation result is ready. */
  readonly deferRotationRender?: boolean;
}

/** Combines baseline output with session state owned by each optional analysis feature. */
export interface ProfessionAppResult
  extends
    BaselineSimulationResult,
    ModifierContributionResultState,
    RandomDistributionResultState,
    RelicComparisonResultState {}

export interface ProfessionAppFilenames {
  readonly build: string;
  readonly rotation: string;
  readonly eventLog: string;
}

export interface ProfessionRuntimeOptions {
  readonly profession: ProfessionAppContract;
  readonly createBuildContext: BuildContextFactory;
}

/** Callers select only the observations and output needed for their analysis. */
export type ProfessionSimulationOptions = Pick<Gw2SimulationOptions, 'observationPolicy' | 'collectChartData'>;

export interface ProfessionRuntimeApi {
  simulateBuild(
    rotation: readonly RotationCommand[],
    config: Gw2Config,
    options: ProfessionSimulationOptions & { output: 'score' }
  ): Gw2SimulationScore;
  simulateBuild(
    rotation: readonly RotationCommand[],
    config: Gw2Config,
    options?: ProfessionSimulationOptions & { output?: 'detailed' }
  ): Gw2SimulationResult;
  eliteSpecialization(build: Gw2CanonicalBuild): string;
  readonly createBuildContext: BuildContextFactory;
  modifierContributionRequest(app: ProfessionAppState): ModifierContributionRequest;
  calculateModifierContributions(request: ModifierContributionRequest): ModifierContribution[];
  randomDistributionRequest(app: ProfessionAppState): RandomDistributionJobRequest | null;
  relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonRequest | null;
  calculateRandomDistribution(
    request: RandomDistributionRequest,
    options?: RandomDistributionOptions
  ): RandomDistributionSummary;
  rotationPlanningStateAt(app: ProfessionAppState, insertionIndex: number): Gw2SimulationResult['planningState'];
  /** Simulates a prefix and optional candidate commands with the original combat-start boundary. */
  rotationPreviewAt(
    app: ProfessionAppState,
    insertionIndex: number,
    appended?: readonly RotationCommand[]
  ): Gw2SimulationResult;
  baselineSimulationRequest(app: ProfessionAppState): BaselineSimulationRequest;
  calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput;
}

export interface ProfessionFeatureRunner {
  readonly isRunning?: boolean;
  cancel?(): void;
  schedule(run?: boolean): void;
}

export interface Gw2AppAdapter extends ProfessionRuntimeApi {
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
  /** Resolve imported names for the active build without applying saved-build migration to explicit commands. */
  readonly rotationImportLookup: (app: ProfessionAppState) => CatalogLookup;
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
  readonly rotationImportLookup?: Gw2AppAdapter['rotationImportLookup'];
  readonly storageVersion?: number;
  readonly resetPrompt?: string;
  readonly isSkillAvailable?: ProfessionIsSkillAvailable;
  readonly defaultOffhand?: ProfessionDefaultOffhand;
}
