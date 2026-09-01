import type {
  CatalogEntity,
  CanonicalCatalog,
  ObservationPolicy,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionUiContract,
  RotationCommand,
  SchedulerRecord,
  Skill,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  Gw2ApplyBuildAttributeRules,
  Gw2ApplicationBuild,
  Gw2CalculateAttributes,
  Gw2FinalizedAttributeResult,
  ProfessionAssumptionControl
} from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ProfessionContract, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { Gw2WeaponDataEntry } from '#gw2/platform/equipment/types.js';
import type { PatchPreview, PatchRuntimeValues } from '#gw2/integrations/patches/authoring/patches.js';
import type { RelicComparisonModel } from '#gw2/app/simulation/relic-comparison.js';
import type { BuildEditor, GameContentAddress, SimulationPresentation } from '#app/shell/types.js';
import type { RotationHotkeyImport } from '#gw2/app/rotation/input/hotkeys.js';

export interface ProfessionAppContract {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly preview?: PatchPreview | null;
  readonly catalogFor?: (patchId?: string) => Readonly<CanonicalCatalog>;
  readonly patchValuesFor?: (patchId?: string) => PatchRuntimeValues;
  createBuildDefaults(): SchedulerRecord;
  migrateBuild(saved: SchedulerRecord): SchedulerRecord;
}

export interface ProfessionAttributeData extends Gw2FinalizedAttributeResult {
  activeTraits: CatalogEntity[];
}

export type ProfessionModifierType = 'Boon' | 'Target' | 'Sigil' | 'Relic' | 'Food' | 'Trait';

export interface ProfessionModifier {
  readonly id: string;
  readonly type: ProfessionModifierType;
  readonly name: string;
  readonly label: string;
}

export interface ProfessionModifierComparison {
  readonly modifier: ProfessionModifier;
  readonly config: Gw2Config;
}

export interface ModifierContributionRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly comparisons: readonly ProfessionModifierComparison[];
}

export interface ModifierContribution {
  readonly id: string;
  readonly name: string;
  readonly dpsIncrease: number;
  readonly pctIncrease: number;
}

export interface RandomDistributionRequest {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly trials?: number;
  readonly seedStart?: number;
}

export interface RandomDistributionJobRequest extends RandomDistributionRequest, GameContentAddress {
  readonly trials: number;
}

export interface RelicComparisonJobRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly opponentRelic: string;
  readonly comparisonRelic: string;
}

export interface RandomDistributionOptions {
  readonly includeSamples?: boolean;
  readonly onProgress?: (progress: {
    readonly completed: number;
    readonly total: number;
    readonly percent: number;
  }) => void;
}

export interface RandomDistributionProgress {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

export type RandomDistributionMetricCategory = 'critical' | 'condition' | 'proc' | 'effect' | 'weapon-strength';

export type RandomDistributionMetricUnit = 'count' | 'stacks' | 'value';

/** One compact, profession-neutral observation collected from an RNG trial. */
export interface RandomDistributionMetricSample {
  readonly id: string;
  readonly group: string;
  readonly label: string;
  readonly category: RandomDistributionMetricCategory;
  readonly unit: RandomDistributionMetricUnit;
  readonly value: number;
}

/** Internal worker payload used to merge explanation data across trial batches. */
export interface RandomDistributionOutcome {
  readonly dps: number;
  readonly metrics: readonly RandomDistributionMetricSample[];
}

export interface RandomDistributionDriver {
  readonly id: string;
  readonly label: string;
  readonly category: RandomDistributionMetricCategory;
  readonly unit: RandomDistributionMetricUnit;
  readonly lowAverage: number;
  readonly overallAverage: number;
  readonly highAverage: number;
  readonly delta: number;
  readonly correlation: number;
  readonly estimatedDpsDelta: number;
}

export interface RandomDistributionExplanation {
  readonly cohortPercent: number;
  readonly lowDpsMean: number;
  readonly highDpsMean: number;
  readonly drivers: readonly RandomDistributionDriver[];
}

export interface RandomDistributionSummary {
  readonly trials: number;
  readonly mean: number;
  readonly p01: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
  readonly samples?: readonly number[];
  readonly outcomes?: readonly RandomDistributionOutcome[];
  readonly explanation?: RandomDistributionExplanation;
}

export interface BuildTemplatePreset extends SchedulerRecord {
  readonly label: string;
  readonly build: string;
  readonly rotation?: string;
  readonly snowCrowsUrl?: string;
  readonly benchmarkDps?: number;
  readonly section?: string | null;
}

export interface BuildTemplateSection {
  readonly section?: string | null;
  readonly presets?: readonly BuildTemplatePreset[];
}

export interface BuildTemplateSelection {
  readonly build: string;
  readonly signature: string;
}

export interface RotationActionOptions extends SchedulerRecord {
  readonly skillId?: SkillId | null;
  readonly concurrentOffsetMs?: number | null;
  readonly interruptAfterMs?: number | null;
  readonly releaseAtCharges?: number | null;
  readonly doubleEdgeOutcome?: 'success' | 'backfire' | null;
  readonly durationMs?: number | null;
}

export interface ProfessionSpecializationTrait extends CatalogEntity {
  readonly icon: string;
  readonly description: string;
}

export interface ProfessionSpecialization extends CatalogEntity {
  readonly icon: string;
  readonly elite: boolean;
  readonly minorTraits: readonly ProfessionSpecializationTrait[];
  readonly majorTraits: readonly (readonly ProfessionSpecializationTrait[])[];
}

export interface ProfessionSlotLoadout extends SchedulerRecord {
  readonly startingKey: string;
  readonly palettePlacement?: string;
  normalizeBuild(
    build: Gw2ApplicationBuild,
    context: {
      readonly build: Gw2ApplicationBuild;
      readonly specialization: string;
      readonly professionState?: unknown;
      readonly catalog: CanonicalCatalog;
    }
  ): Partial<Gw2ApplicationBuild> & SchedulerRecord;
  selectedSkillIds(context: {
    readonly build: Gw2ApplicationBuild;
    readonly specialization: string;
    readonly professionState?: unknown;
    readonly catalog: CanonicalCatalog;
  }): readonly SkillId[];
  skillChildren?(context: ProfessionSlotLoadoutContext, skillId: SkillId): readonly SkillId[];
  paletteGroups(context: ProfessionSlotLoadoutContext): ProfessionPaletteGroup[];
  unavailableReason(skill: Skill, context: ProfessionSlotLoadoutContext): string;
  view(context: ProfessionSlotLoadoutContext): ProfessionSlotLoadoutView;
  updateBuild(
    build: Gw2ApplicationBuild,
    selectorKey: string,
    value: string,
    context: ProfessionSlotLoadoutContext
  ): Gw2ApplicationBuild;
}

export interface ProfessionSlotLoadoutContext {
  readonly build: Gw2ApplicationBuild;
  readonly specialization: string;
  readonly professionState?: unknown;
  readonly catalog: CanonicalCatalog;
}

export interface ProfessionSlotLoadoutOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

export interface ProfessionSlotLoadoutSelector {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly ProfessionSlotLoadoutOption[];
}

export interface ProfessionSlotLoadoutBar {
  readonly id: string;
  readonly label: string;
  readonly compactLabel?: string;
  readonly icon?: string;
  readonly active: boolean;
  readonly skillIds: readonly SkillId[];
}

export interface ProfessionSlotLoadoutView {
  readonly label: string;
  readonly selectionControl: string;
  readonly formatActiveBar: boolean;
  readonly selectors: readonly ProfessionSlotLoadoutSelector[];
  readonly bars: readonly ProfessionSlotLoadoutBar[];
}

export interface ProfessionAppState {
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
  modifierContributionRunner: ProfessionFeatureRunner;
  randomDistributionRunner: ProfessionFeatureRunner;
  relicComparisonRunner: ProfessionFeatureRunner;
  baselineSimulationRunner: {
    schedule(revision: number): void;
  };
  publishBaselineSimulation(output: BaselineSimulationOutput, revision: number): void;
  failBaselineSimulation(error: unknown, revision: number): void;
  changed(rebuildStatic?: boolean, rebuildGear?: boolean, options?: ProfessionChangeOptions): void;
  renderGear(): void;
  renderTraits(): void;
  renderAttributes(): void;
  renderSkills(): void;
  renderAssumptions(): void;
  addRotation(name: string, options?: RotationActionOptions): void;
  runRandomDistribution(): void;
  runRelicComparison(): void;
  resetBuild(): void;
  selectPatch(patchId: string): void;
}

export interface ProfessionChangeOptions {
  /** Holds replacement-heavy rotation UI until its matching simulation result is ready. */
  readonly deferRotationRender?: boolean;
}

export interface PatchComparison {
  readonly patchId: string;
  readonly current: Gw2SimulationResult;
  readonly preview: Gw2SimulationResult;
}

/** Serializable input sent to the dedicated baseline-simulation worker. */
export interface BaselineSimulationRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly selectedPatchId: string;
  readonly previewPatchId?: string;
}

/** Complete baseline output, including both sides of an optional patch preview. */
export interface BaselineSimulationOutput {
  readonly result: Gw2SimulationResult;
  readonly patchComparison: PatchComparison | null;
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
  relicComparison?: RelicComparisonModel;
}

export interface ProfessionAppFilenames {
  readonly build: string;
  readonly rotation: string;
  readonly eventLog: string;
}

export interface ProfessionSkillAvailabilityContext {
  readonly build?: Gw2ApplicationBuild;
  readonly specialization?: string;
  readonly professionState?: unknown;
}

export interface ProfessionOffhandContext {
  readonly mainHand?: string;
  readonly offHands?: readonly string[];
}

export type ProfessionIsSkillAvailable = (skill: Skill, context?: ProfessionSkillAvailabilityContext) => boolean;

export type ProfessionDefaultOffhand = (context?: ProfessionOffhandContext) => string;

export interface ProfessionRuntimeConfigContext {
  readonly attributeData: ProfessionAttributeData;
  readonly specialization: string;
  readonly activeTraits: readonly CatalogEntity[];
}

export interface ProfessionRuntimeOverrides {
  readonly buildConfigInputs?: (app: ProfessionAppState, context: ProfessionRuntimeConfigContext) => SchedulerRecord;
  readonly buildConfigExtras?: (app: ProfessionAppState) => SchedulerRecord;
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
  relicComparisonRequest(app: ProfessionAppState): RelicComparisonJobRequest | null;
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
  schedule(run?: boolean): void;
  run?(): void;
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
