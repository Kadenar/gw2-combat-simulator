import type {
  CatalogEntity,
  CanonicalCatalog,
  LegacyRotationItem,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2ApplyBuildAttributeRules,
  Gw2ApplicationBuild,
  Gw2CalculateAttributes,
  Gw2Config,
  Gw2FinalizedAttributeResult,
  Gw2ProfessionContract,
  Gw2SimulationResult,
  Gw2SlotLoadout,
  Gw2WeaponDataEntry,
} from "../../platform/gw2/types.js";

export interface ProfessionBuildAssumptions extends SchedulerRecord {
  might?: number;
  fury?: boolean;
  quickness?: boolean;
  alacrity?: boolean;
  protection?: boolean;
  resolution?: boolean;
  regeneration?: boolean;
  swiftness?: boolean;
  vigor?: boolean;
  aegis?: boolean;
  alliedPlayerCount?: number;
  sharePlayerBoonsWithSummons?: boolean;
  playerHealthPercent?: number;
  targetDefiant?: boolean;
  targetDistance?: number;
  targetMoving?: boolean;
  targetBoonless?: boolean;
  targetSkillActivationsPerSecond?: number;
  targetConditions?: Record<string, number | boolean>;
}

export type ProfessionApplicationBuild = Gw2ApplicationBuild;

export interface ProfessionAppContract {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  createBuildDefaults(): SchedulerRecord;
  migrateBuild(saved: SchedulerRecord): SchedulerRecord;
}

export interface ProfessionAttributeData
  extends Gw2FinalizedAttributeResult {
  activeTraits: CatalogEntity[];
}

export type ProfessionModifierType =
  | "Boon"
  | "Target"
  | "Sigil"
  | "Relic"
  | "Food"
  | "Trait";

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

export interface ModifierContributionRequest {
  readonly professionId: string;
  readonly rotation: readonly LegacyRotationItem[];
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
  readonly professionId?: string;
  readonly rotation: readonly LegacyRotationItem[];
  readonly baseConfig: Gw2Config;
  readonly trials?: number;
  readonly seedStart?: number;
}

export interface RandomDistributionJobRequest
  extends RandomDistributionRequest {
  readonly professionId: string;
  readonly trials: number;
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

export type RandomDistributionMetricCategory =
  | "critical"
  | "condition"
  | "proc"
  | "effect"
  | "weapon-strength";

export type RandomDistributionMetricUnit =
  | "count"
  | "stacks"
  | "value";

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
  readonly interruptMs?: number | null;
}

export interface ProfessionAssumptionOption {
  readonly value: string;
  readonly label: string;
  readonly skillId?: number;
  readonly icon?: string;
}

export interface ProfessionAssumptionControlInput {
  readonly key?: unknown;
  readonly label?: unknown;
  readonly type?: unknown;
  readonly defaultValue?: unknown;
  readonly minimum?: unknown;
  readonly maximum?: unknown;
  readonly step?: unknown;
  readonly options?: unknown;
  readonly specializations?: unknown;
  readonly section?: unknown;
}

export interface ProfessionAssumptionControlBase extends SchedulerRecord {
  readonly key: string;
  readonly label: string;
  readonly defaultValue: unknown;
  readonly specializations?: readonly string[];
  readonly section?: string;
}

export type ProfessionAssumptionControl =
  | (ProfessionAssumptionControlBase & {
      readonly type: "boolean";
    })
  | (ProfessionAssumptionControlBase & {
      readonly type: "number";
      readonly minimum: number;
      readonly maximum: number;
      readonly step: number;
    })
  | (ProfessionAssumptionControlBase & {
      readonly type: "select";
      readonly options: readonly ProfessionAssumptionOption[];
    });

export interface ProfessionSpecializationTrait extends CatalogEntity {
  readonly icon: string;
  readonly description: string;
}

export interface ProfessionSpecialization extends CatalogEntity {
  readonly icon: string;
  readonly elite: boolean;
  readonly minorTraits: readonly ProfessionSpecializationTrait[];
  readonly majorTraits: readonly (
    readonly ProfessionSpecializationTrait[]
  )[];
}

export interface ProfessionSlotLoadout extends SchedulerRecord {
  readonly startingKey: string;
  readonly palettePlacement?: string;
  normalizeBuild(
    build: ProfessionApplicationBuild,
    context: {
      readonly build: ProfessionApplicationBuild;
      readonly specialization: string;
      readonly professionState?: unknown;
      readonly catalog: CanonicalCatalog;
    },
  ): Partial<ProfessionApplicationBuild> & SchedulerRecord;
  selectedSkillIds(context: {
    readonly build: ProfessionApplicationBuild;
    readonly specialization: string;
    readonly professionState?: unknown;
    readonly catalog: CanonicalCatalog;
  }): readonly SkillId[];
  skillChildren?(
    context: ProfessionSlotLoadoutContext,
    skillId: SkillId,
  ): readonly SkillId[];
  paletteGroups(
    context: ProfessionSlotLoadoutContext,
  ): import("../../platform/engine/types.js").ProfessionPaletteGroup[];
  unavailableReason(
    skill: Skill,
    context: ProfessionSlotLoadoutContext,
  ): string;
  view(context: ProfessionSlotLoadoutContext): ProfessionSlotLoadoutView;
  updateBuild(
    build: ProfessionApplicationBuild,
    selectorKey: string,
    value: string,
    context: ProfessionSlotLoadoutContext,
  ): ProfessionApplicationBuild;
}

export interface ProfessionSlotLoadoutContext {
  readonly build: ProfessionApplicationBuild;
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
  adapter: Gw2AppAdapter;
  profession: ProfessionAppContract;
  build: ProfessionApplicationBuild;
  skills: Skill[];
  skillByName: ReadonlyMap<string, Skill>;
  skillById: ReadonlyMap<SkillId, Skill>;
  weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  relicNames: readonly string[];
  specializations: CanonicalCatalog["specializations"];
  resourceDefinitions(
    specialization: string,
  ): ProfessionResourceView[];
  resourceDefinition(
    specialization: string,
  ): ProfessionResourceView | null;
  attributeWeaponSet: number;
  attributeData: ProfessionAttributeData | null;
  results: ProfessionAppResult | null;
  dragState: ProfessionRotationDragState | null;
  procVisibility?: Set<string>;
  procVisibilityKeys?: Set<string>;
  procFilterOpen?: boolean;
  procHighlightKey?: string | null;
  _skillBreakdownState?: {
    readonly skillRows: readonly SchedulerRecord[];
  };
  _skillSortCol?: string | null;
  _skillSortDir?: "asc" | "desc" | null;
  _rotationHistory?: {
    undo: LegacyRotationItem[][];
    redo: LegacyRotationItem[][];
    current: LegacyRotationItem[];
  };
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: ProfessionApplicationBuild | null;
  modifierContributionRunner: {
    schedule(): void;
  };
  randomDistributionRunner: {
    readonly isRunning: boolean;
    schedule(run?: boolean): void;
    run(): void;
  };
  changed(rebuildStatic?: boolean, rebuildGear?: boolean): void;
  renderGear(): void;
  renderTraits(): void;
  renderAttributes(): void;
  renderSkills(): void;
  renderAssumptions(): void;
  addRotation(name: string, options?: RotationActionOptions): void;
  runRandomDistribution(): void;
  resetBuild(): void;
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
}

export interface ProfessionAppFilenames {
  readonly build: string;
  readonly rotation: string;
  readonly eventLog: string;
}

export interface ProfessionSkillAvailabilityContext {
  readonly build?: ProfessionApplicationBuild;
  readonly specialization?: string;
  readonly professionState?: unknown;
}

export interface ProfessionOffhandContext {
  readonly mainHand?: string;
  readonly offHands?: readonly string[];
}

export type ProfessionIsSkillAvailable = (
  skill: Skill,
  context?: ProfessionSkillAvailabilityContext,
) => boolean;

export type ProfessionDefaultOffhand = (
  context?: ProfessionOffhandContext,
) => string;

export interface ProfessionRuntimeConfigContext {
  readonly attributeData: ProfessionAttributeData;
  readonly specialization: string;
  readonly activeTraits: readonly CatalogEntity[];
}

export interface ProfessionRuntimeOverrides {
  readonly buildConfigInputs?: (
    app: ProfessionAppState,
    context: ProfessionRuntimeConfigContext,
  ) => SchedulerRecord;
  readonly buildConfigExtras?: (
    app: ProfessionAppState,
  ) => SchedulerRecord;
  readonly isContributionTrait?: (
    trait: CatalogEntity,
    app: ProfessionAppState,
  ) => boolean;
}

export interface ProfessionRuntimeOptions
  extends ProfessionRuntimeOverrides {
  readonly profession: ProfessionAppContract;
  readonly calculateAttributes: Gw2CalculateAttributes;
}

export interface ProfessionRuntimeApi {
  simulateBuild(
    rotation: readonly unknown[],
    config: Gw2Config,
  ): Gw2SimulationResult;
  eliteSpecialization(build: ProfessionApplicationBuild): string;
  recalculate(app: ProfessionAppState): void;
  simulationConfig(
    app: ProfessionAppState,
    disabled?: ProfessionModifier | null,
  ): Gw2Config;
  modifierCandidates(
    app: ProfessionAppState,
  ): ProfessionModifier[];
  modifierContributionRequest(
    app: ProfessionAppState,
  ): ModifierContributionRequest;
  calculateModifierContributions(
    request: ModifierContributionRequest,
  ): ModifierContribution[];
  computeModifierContributions(
    app: ProfessionAppState,
  ): ModifierContribution[];
  randomDistributionRequest(
    app: ProfessionAppState,
  ): RandomDistributionJobRequest | null;
  calculateRandomDistribution(
    request: RandomDistributionRequest,
    options?: RandomDistributionOptions,
  ): RandomDistributionSummary;
  runSimulation(app: ProfessionAppState): Gw2SimulationResult;
}

export interface Gw2AppAdapterOptions {
  readonly profession: ProfessionAppContract;
  readonly storageKey: string;
  readonly globalName: string;
  readonly filenames: ProfessionAppFilenames;
  readonly resetPrompt: string;
  readonly specializationFallback: string;
  readonly createDefaultTargetConditions: () => Record<
    string,
    number | boolean
  >;
  readonly toApplicationBuild: (
    build: unknown,
  ) => ProfessionApplicationBuild;
  readonly eliteSpecialization:
    ProfessionRuntimeApi["eliteSpecialization"];
  readonly recalculate: ProfessionRuntimeApi["recalculate"];
  readonly runSimulation: ProfessionRuntimeApi["runSimulation"];
  readonly modifierContributionRequest:
    ProfessionRuntimeApi["modifierContributionRequest"];
  readonly calculateModifierContributions:
    ProfessionRuntimeApi["calculateModifierContributions"];
  readonly randomDistributionRequest:
    ProfessionRuntimeApi["randomDistributionRequest"];
  readonly calculateRandomDistribution:
    ProfessionRuntimeApi["calculateRandomDistribution"];
  readonly isSkillAvailable: ProfessionIsSkillAvailable;
  readonly defaultOffhand: ProfessionDefaultOffhand;
}

export interface Gw2AppAdapter extends Gw2AppAdapterOptions {
  readonly id: string;
  readonly name: string;
  readonly specializations:
    CanonicalCatalog["specializations"];
  readonly weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  readonly relicNames: readonly string[];
  readonly renderResults: (app: ProfessionAppState) => void;
  readonly renderRotationBuilder: (app: ProfessionAppState) => void;
  readonly slotLoadout: ProfessionSlotLoadout | null;
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
  readonly weaponSkillMatchesSet: NonNullable<
    ProfessionUiContract["weaponSkillMatchesSet"]
  >;
}

export interface DefineProfessionAppOptions {
  readonly profession: ProfessionAppContract;
  readonly applyBuildAttributeRules: Gw2ApplyBuildAttributeRules;
  readonly createDefaultTargetConditions: () => Record<
    string,
    number | boolean
  >;
  readonly toApplicationBuild: (
    build: unknown,
  ) => ProfessionApplicationBuild;
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

export interface ProfessionAppDefinition extends ProfessionRuntimeApi {
  readonly appAdapter: Gw2AppAdapter;
  readonly calculateAttributes: Gw2CalculateAttributes;
}

export interface Gw2SimulationConfigOptions {
  readonly app: ProfessionAppState;
  readonly attributeData: ProfessionAttributeData;
  readonly specialization: string;
  readonly disabled?: ProfessionModifier | null;
  readonly selectedTraits?: readonly string[];
  readonly selectedTraitIds?: readonly SkillId[];
  readonly initialResource?: number;
  readonly adjustConditionDurationBonus?: (
    name: string,
    bonus: number,
  ) => number;
}
