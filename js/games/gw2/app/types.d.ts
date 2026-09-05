/** Composes application state, adapters, and runtime callbacks from domain-owned contracts. */
import type { Gw2ProfessionSource, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { PatchPreview, PatchRuntimeValues } from '#gw2/integrations/patches/authoring/patches.js';
import type { CanonicalCatalog, SkillId, Skill, CatalogEntity } from '#gw2/platform/engine/skills/types.js';
import type { SchedulerRecord, RotationCommand, ObservationPolicy } from '#gw2/platform/engine/execution/types.js';
import type {
  PatchComparison,
  BaselineSimulationOutput,
  ModifierContribution,
  RandomDistributionProgress,
  RandomDistributionSummary,
  ProfessionModifier,
  ModifierContributionRequest,
  RandomDistributionJobRequest,
  RelicComparisonJobRequest,
  RandomDistributionRequest,
  RandomDistributionOptions,
  BaselineSimulationRequest
} from '#gw2/app/simulation/types.js';
import type {
  Gw2ApplicationBuild,
  Gw2CalculateAttributes,
  ProfessionAssumptionControl,
  Gw2ApplyBuildAttributeRules
} from '#gw2/platform/builds/types.js';
import type { Gw2WeaponDataEntry } from '#gw2/platform/equipment/types.js';
import type { ProfessionResourceView, ProfessionUiContract } from '#gw2/platform/engine/profession/types.js';
import type {
  ProfessionAttributeData,
  BuildTemplatePreset,
  BuildTemplateSelection,
  ProfessionIsSkillAvailable,
  ProfessionDefaultOffhand,
  ProfessionSlotLoadout
} from '#gw2/app/build/types.js';
import type { RelicComparisonModel } from '#gw2/app/simulation/relic-comparison.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationHotkeyImport } from '#gw2/app/rotation/input/hotkeys.js';
import type { BuildEditor, SimulationPresentation } from '#app/shell/types.js';

export type ProfessionAppContract = Gw2ProfessionSource & {
  readonly preview?: PatchPreview | null;
  readonly catalogFor?: (patchId?: string) => Readonly<CanonicalCatalog>;
  readonly patchValuesFor?: (patchId?: string) => PatchRuntimeValues;
};

export interface RotationActionOptions extends SchedulerRecord {
  readonly skillId?: SkillId | null;
  readonly offTarget?: boolean | null;
  readonly concurrentOffsetMs?: number | null;
  readonly interruptAfterMs?: number | null;
  readonly releaseAtCharges?: number | null;
  readonly doubleEdgeOutcome?: 'success' | 'backfire' | null;
  readonly durationMs?: number | null;
}

export interface RotationComparisonState {
  referenceRotation: RotationCommand[];
  referenceResult: Gw2SimulationResult | null;
  referenceStatus: 'empty' | 'fresh' | 'queued' | 'error';
  referenceError: string;
}

export interface ProfessionAppState {
  workspace?: import('#gw2/app/build/state/workspace.js').BuildWorkspace;
  activateBuildTab?(id: string): void;
  readonly gameId: string;
  readonly contentId: string;
  adapter: Gw2AppAdapter;
  profession: ProfessionAppContract;
  activeCatalog: Readonly<CanonicalCatalog>;
  patchId: string;
  patchComparison: PatchComparison | null;
  build: Gw2ApplicationBuild;
  skills: Skill[];
  skillByName: ReadonlyMap<string, Skill>;
  skillById: ReadonlyMap<SkillId, Skill>;
  weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  relicNames: readonly string[];
  specializations: CanonicalCatalog['specializations'];
  resourceDefinitions(specialization: string): ProfessionResourceView[];
  attributeWeaponSet: number;
  attributeData: ProfessionAttributeData | null;
  results: ProfessionAppResult | null;
  buildRevision: number;
  resultRevision: number;
  rotationComparison: RotationComparisonState | null;
  simulationStatus: 'idle' | 'queued' | 'running' | 'error';
  simulationError: string;
  dragState: ProfessionRotationDragState | null;
  rotationInsertionIndex?: number | null;
  procVisibility?: Set<string>;
  procVisibilityKeys?: Set<string>;
  procFilterOpen?: boolean;
  procHighlightKey?: string | null;
  overlaySigilProcs?: boolean;
  overlayRelicProcs?: boolean;
  overlaySovereignOfLightProcs?: boolean;
  rotationSkillHighlightKey?: string | null;
  _skillBreakdownState?: {
    readonly skillRows: readonly SchedulerRecord[];
  };
  _skillSortCol?: string | null;
  _skillSortDir?: 'asc' | 'desc' | null;
  _rotationHistory?: {
    undo: RotationCommand[][];
    redo: RotationCommand[][];
    current: RotationCommand[];
  };
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: Gw2ApplicationBuild | null;
  templateUndoMessage?: string;
  modifierContributionRunner: ProfessionFeatureRunner;
  randomDistributionRunner: ProfessionFeatureRunner;
  relicComparisonRunner: ProfessionFeatureRunner;
  baselineSimulationRunner: {
    schedule(revision: number): void;
  };
  publishBaselineSimulation(output: BaselineSimulationOutput, revision: number): void;
  failBaselineSimulation(error: unknown, revision: number): void;
  changed(rebuildStatic?: boolean, rebuildGear?: boolean, options?: ProfessionChangeOptions): void;
  startRotationComparison(): void;
  loadRotationReference(rotation: readonly RotationCommand[]): void;
  clearRotationReference(): void;
  swapRotationComparison(): void;
  exitRotationComparison(): void;
  renderGear(): void;
  renderTraits(): void;
  renderAttributes(): void;
  renderSkills(): void;
  renderAssumptions(): void;
  addRotation(name: string, options?: RotationActionOptions): void;
  runRandomDistribution(): void;
  runRelicComparison(comparisonRelic?: string, initialStacks?: number): void;
  resetBuild(): void;
  selectPatch(patchId: string): void;
}

export interface ProfessionChangeOptions {
  /** Holds replacement-heavy rotation UI until its matching simulation result is ready. */
  readonly deferRotationRender?: boolean;
}

export interface ProfessionRotationDragState extends SchedulerRecord {
  readonly source?: string;
  readonly index?: number;
  readonly name?: string;
  readonly skillId?: SkillId;
}

export interface ProfessionAppResult extends Gw2SimulationResult {
  contributions?: ModifierContribution[];
  modifierContributionsStale?: boolean;
  modifierContributionsError?: string;
  randomDistributionRequested?: boolean;
  randomDistributionStale?: boolean;
  randomDistributionTrials?: number;
  randomDistributionError?: string;
  randomDistributionProgress?: RandomDistributionProgress;
  randomDistribution?: RandomDistributionSummary;
  relicComparisonAvailable?: boolean;
  relicComparisonStale?: boolean;
  relicComparisonError?: string;
  relicComparisonOpponent?: string;
  relicComparisonTarget?: string;
  relicComparisonInitialStacks?: number;
  relicComparison?: RelicComparisonModel;
}

export interface ProfessionAppFilenames {
  readonly build: string;
  readonly rotation: string;
  readonly eventLog: string;
}

export interface ProfessionRuntimeConfigContext {
  readonly attributeData: ProfessionAttributeData;
  readonly specialization: string;
  readonly activeTraits: readonly CatalogEntity[];
}

export interface ProfessionRuntimeOverrides {
  readonly buildConfigInputs?: (app: ProfessionAppState, context: ProfessionRuntimeConfigContext) => SchedulerRecord;
  readonly buildConfigExtras?: (app: ProfessionAppState, context: ProfessionRuntimeConfigContext) => SchedulerRecord;
}

export interface ProfessionRuntimeOptions extends ProfessionRuntimeOverrides {
  readonly profession: ProfessionAppContract;
  readonly calculateAttributes: Gw2CalculateAttributes;
}

export interface ProfessionRuntimeApi {
  simulateBuild(
    rotation: readonly RotationCommand[],
    config: Gw2Config,
    observationPolicy?: ObservationPolicy
  ): Gw2SimulationResult;
  eliteSpecialization(build: Gw2ApplicationBuild): string;
  recalculate(app: ProfessionAppState): void;
  simulationConfig(app: ProfessionAppState, disabled?: ProfessionModifier | null): Gw2Config;
  modifierContributionRequest(app: ProfessionAppState): ModifierContributionRequest;
  calculateModifierContributions(request: ModifierContributionRequest): ModifierContribution[];
  randomDistributionRequest(app: ProfessionAppState): RandomDistributionJobRequest | null;
  relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonJobRequest | null;
  calculateRandomDistribution(
    request: RandomDistributionRequest,
    options?: RandomDistributionOptions
  ): RandomDistributionSummary;
  rotationEndStateAt(app: ProfessionAppState, insertionIndex: number): Gw2SimulationResult['endState'];
  baselineSimulationRequest(app: ProfessionAppState): BaselineSimulationRequest;
  calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput;
  runSimulation(app: ProfessionAppState): Gw2SimulationResult;
}

export interface ProfessionFeatureRunner {
  readonly isRunning?: boolean;
  cancel?(): void;
  schedule(run?: boolean): void;
  run?(value?: string, extra?: number): void;
}

export interface Gw2AppCapabilities {
  readonly modifierContributions?: true;
  readonly randomDistribution?: true;
  readonly relicComparison?: true;
  readonly patchPreview?: {
    mount(app: ProfessionAppState): void | Promise<void>;
    render(container: HTMLElement, app: ProfessionAppState): void | Promise<void>;
  };
  readonly keybindImport?: RotationHotkeyImport;
}

export interface Gw2AppAdapter extends ProfessionRuntimeApi {
  readonly gameId: 'gw2';
  readonly contentId: string;
  readonly id: string;
  readonly name: string;
  readonly profession: ProfessionAppContract;
  readonly storageKey: string;
  readonly globalName: string;
  readonly filenames: ProfessionAppFilenames;
  readonly resetPrompt: string;
  readonly specializationFallback: string;
  readonly createDefaultTargetConditions: () => Record<string, number | boolean>;
  readonly toApplicationBuild: (build: unknown) => Gw2ApplicationBuild;
  readonly isSkillAvailable: ProfessionIsSkillAvailable;
  readonly defaultOffhand: ProfessionDefaultOffhand;
  readonly specializations: CanonicalCatalog['specializations'];
  readonly weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  readonly relicNames: readonly string[];
  readonly renderRotationBuilder: (app: ProfessionAppState) => void;
  readonly buildEditor: BuildEditor<ProfessionAppState>;
  readonly presentation: SimulationPresentation<ProfessionAppState>;
  readonly capabilities: Gw2AppCapabilities;
  readonly slotLoadout: ProfessionSlotLoadout | null;
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
  readonly weaponSkillMatchesSet: NonNullable<ProfessionUiContract['weaponSkillMatchesSet']>;
}

export interface DefineProfessionAppOptions {
  readonly profession: ProfessionAppContract;
  readonly applyBuildAttributeRules: Gw2ApplyBuildAttributeRules;
  readonly createDefaultTargetConditions?: () => Record<string, number | boolean>;
  readonly toApplicationBuild: (build: unknown) => Gw2ApplicationBuild;
  readonly specializationFallback: string;
  readonly storageVersion?: number;
  readonly storageKey?: string;
  readonly globalName?: string;
  readonly filenames?: ProfessionAppFilenames;
  readonly resetPrompt?: string;
  readonly runtime?: ProfessionRuntimeOverrides;
  readonly isSkillAvailable?: ProfessionIsSkillAvailable;
  readonly defaultOffhand?: ProfessionDefaultOffhand;
}

export interface Gw2SimulationConfigOptions {
  readonly app: ProfessionAppState;
  readonly attributeData: ProfessionAttributeData;
  readonly attributeDataByWeaponSet?: readonly ProfessionAttributeData[];
  readonly specialization: string;
  readonly disabled?: ProfessionModifier | null;
  readonly selectedTraitIds?: readonly SkillId[];
  readonly initialResource?: number;
  readonly adjustConditionDurationBonus?: (name: string, bonus: number) => number;
}
