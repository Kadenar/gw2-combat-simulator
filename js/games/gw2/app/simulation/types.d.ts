/** Defines simulation requests and worker results shared by the app runners and analysis views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#app/shell/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

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

export interface PatchComparison {
  readonly patchId: string;
  readonly current: Gw2SimulationResult;
  readonly preview: Gw2SimulationResult;
}

/** Serializable input sent to the dedicated baseline-simulation worker. */
export interface BaselineSimulationRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly referenceRotation?: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly selectedPatchId: string;
  readonly previewPatchId?: string;
}

/** Complete baseline output, including both sides of an optional patch preview. */
export interface BaselineSimulationOutput {
  readonly result: Gw2SimulationResult;
  readonly patchComparison: PatchComparison | null;
  readonly referenceResult?: Gw2SimulationResult;
}
